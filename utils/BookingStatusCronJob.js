import cron from 'node-cron';
import mongoose from 'mongoose';
import Booking from '../model/Booking.js';
import MonthlyBooking from '../model/MonthlyBooking.js';
import Attendance from '../model/Attendance.js';
import MonthlyBookingAttendance from '../model/MonthlyBookingAttendance.js';
import moment from 'moment';

// Function to update booking statuses
const updateBookingStatuses = async () => {
  try {
    console.log('⏰ Running booking status update cron job...');
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Update one-time bookings
    await updateOneTimeBookings(now, today);
    
    // Update monthly bookings
    await updateMonthlyBookings(now, today);
    
    console.log('✅ Booking status update completed successfully');
  } catch (error) {
    console.error('❌ Error in booking status update cron job:', error);
  }
};

// Update one-time bookings status
const updateOneTimeBookings = async (now, today) => {
  try {
    // Get all confirmed one-time bookings for today or past dates
    const oneTimeBookings = await Booking.find({
      bookingDate: { $lte: today },
      status: { $in: ['confirmed', 'checked-in'] }
    }).populate('timeSlot');

    for (const booking of oneTimeBookings) {
      const bookingDate = new Date(booking.bookingDate);
      bookingDate.setHours(0, 0, 0, 0);

      // Check if booking date is today or in the past
      if (bookingDate <= today) {
        // Check if user didn't check in (missed booking) - Check in Attendance model
        const attendance = await Attendance.findOne({
          booking: booking._id,
          checkInTime: { 
            $gte: bookingDate,
            $lt: new Date(bookingDate.getTime() + 24 * 60 * 60 * 1000)
          }
        });

        if (!attendance) {
          // User didn't check in - check if time slot has ended
          if (booking.timeSlot && booking.timeSlot.endTime) {
            const timeSlot = await TimeSlot.findById(booking.timeSlot._id);
            if (timeSlot) {
              const endTime = moment(timeSlot.endTime, 'HH:mm');
              const currentTime = moment(now);
              
              // If current time is after the time slot end time + 1 hour buffer
              if (currentTime.isAfter(endTime.add(1, 'hour'))) {
                if (booking.status !== 'missed') {
                  await Booking.findByIdAndUpdate(
                    booking._id,
                    { status: 'missed' }
                  );
                  console.log(`📝 Booking ${booking._id} marked as missed (no check-in, time slot ended)`);
                }
              }
            }
          }
        } 
        else if (attendance && !attendance.checkOutTime) {
          // User checked in but didn't check out - check if time slot has ended
          if (booking.timeSlot && booking.timeSlot.endTime) {
            const timeSlot = await TimeSlot.findById(booking.timeSlot._id);
            if (timeSlot) {
              const endTime = moment(timeSlot.endTime, 'HH:mm');
              const currentTime = moment(now);
              
              // If current time is after the time slot end time + 1 hour buffer
              if (currentTime.isAfter(endTime.add(1, 'hour'))) {
                if (booking.status !== 'no-checkout') {
                  await Booking.findByIdAndUpdate(
                    booking._id,
                    { status: 'no-checkout' }
                  );
                  console.log(`📝 Booking ${booking._id} marked as no-checkout (time slot ended)`);
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error updating one-time bookings:', error);
  }
};

// Update monthly bookings status
const updateMonthlyBookings = async (now, today) => {
  try {
    // Get all active monthly bookings
    const monthlyBookings = await MonthlyBooking.find({
      status: { $in: ['confirmed', 'checked-in'] },
      endDate: { $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) } // Include bookings ending today or before
    });

    for (const booking of monthlyBookings) {
      const endDate = new Date(booking.endDate);
      endDate.setHours(23, 59, 59, 999);

      // Check if booking has ended (end date + 1 day buffer)
      const oneDayAfterEnd = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
      
      if (now > oneDayAfterEnd) {
        // Check if user made any check-ins during the booking period - Check in MonthlyBookingAttendance
        const attendanceCount = await MonthlyBookingAttendance.countDocuments({
          booking: booking._id,
          date: { 
            $gte: new Date(booking.startDate.setHours(0, 0, 0, 0)),
            $lte: new Date(booking.endDate.setHours(23, 59, 59, 999))
          }
        });

        if (attendanceCount === 0) {
          // No check-ins during the entire month - mark as missed
          if (booking.status !== 'missed') {
            await MonthlyBooking.findByIdAndUpdate(
              booking._id,
              { status: 'missed' }
            );
            console.log(`📝 Monthly Booking ${booking._id} marked as missed (no check-ins)`);
          }
        } else {
          // User made some check-ins - mark as completed
          if (booking.status !== 'completed') {
            await MonthlyBooking.findByIdAndUpdate(
              booking._id,
              { status: 'completed' }
            );
            console.log(`📝 Monthly Booking ${booking._id} marked as completed`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error updating monthly bookings:', error);
  }
};

// Schedule the cron job to run every 6 hours
const startBookingStatusCron = () => {
  // Run every 6 hours: at 0, 6, 12, 18 hours
  cron.schedule('0 */6 * * *', () => {
    console.log('🔄 Starting scheduled booking status update...');
    updateBookingStatuses();
  });

  // Also run immediately on server start
  console.log('🚀 Initial booking status update started...');
  updateBookingStatuses();
};

export default startBookingStatusCron;