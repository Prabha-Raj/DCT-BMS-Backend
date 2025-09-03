import WithdrawRequest from '../model/WithdrawRequest.js';
import BankDetails from '../model/BankDetails.js';

// Librarian creates a withdraw request
export const createWithdrawRequest = async (req, res) => {
  try {
    const { libraryId, requestedAmount } = req.body;
    if (!libraryId || !requestedAmount) {
      return res.status(400).json({ error: 'Library ID and requested amount are required.' });
    }
    // Check if bank details exist for this library
    const bankDetails = await BankDetails.findOne({ library: libraryId });
    if (!bankDetails) {
      return res.status(400).json({ success: false, message: 'First update your bank details before requesting withdrawal.' });
    }
    const request = await WithdrawRequest.create({
      library: libraryId,
      requestedAmount
    });
    return res.status(201).json({
      success: true,
      message: 'Withdraw request created successfully.',
      request,
      bankDetails
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export async function getAllWithdrawRequests(req, res) {
  try {
    const requests = await WithdrawRequest.find().populate({
      path: 'library',
      populate: { path: 'librarian', select: 'name email mobile' }
    }).sort({requestedAt:-1});
    // Attach bank details for each request
    const requestsWithBankDetails = await Promise.all(requests.map(async (reqObj) => {
      const bankDetails = await BankDetails.findOne({ library: reqObj.library._id });
      return {
        request: reqObj,
        bankDetails
      };
    }));
    return res.json({
      success: true,
      message: 'Withdraw requests fetched successfully.',
      requests: requestsWithBankDetails
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin resolves a withdraw request
export const resolveWithdrawRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await WithdrawRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Request already processed' });
    request.status = 'resolved';
    request.resolvedAt = new Date();
    await request.save();
    const bankDetails = await BankDetails.findOne({ library: request.library });
    return res.json({
      success: true,
      message: 'Withdraw request resolved.',
      request,
      bankDetails
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin rejects a withdraw request
export const rejectWithdrawRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rejectedReason } = req.body;
    const request = await WithdrawRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Request already processed' });
    request.status = 'rejected';
    request.rejectedReason = rejectedReason || 'No reason provided';
    request.rejectedAt = new Date();
    await request.save();
    const bankDetails = await BankDetails.findOne({ library: request.library });
    return res.json({
      success: true,
      message: 'Withdraw request rejected.',
      request,
      bankDetails
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export async function getMyWithdrawRequests(req, res) {
  try {
    const { libraryId } = req.params;
    if (!libraryId) {
      return res.status(400).json({ success: false, message: 'Library ID is required.' });
    }
    const requests = await WithdrawRequest.find({ library: libraryId }).sort({ requestedAt: -1 });
    const bankDetails = await BankDetails.findOne({ library: libraryId });
    return res.json({
      success: true,
      message: 'Withdraw requests fetched successfully.',
      requests,
      bankDetails
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
