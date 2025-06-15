import Inquiry from "../model/InquiryModel.js";

// CREATE
export const createInquiry = async (req, res) => {
  try {
    const { name, email, query } = req.body;
    const newInquiry = new Inquiry({ name, email, query });
    await newInquiry.save();
    res.status(201).json({ message: "Inquiry submitted", data: newInquiry ,success:true});
  } catch (error) {
    res.status(500).json({ message: "Failed to submit inquiry", error: error.message ,success:true});
  }
};

// READ ALL
export const getAllInquiries = async (req, res) => {
  try {
    const inquiries = await Inquiry.find();
    res.status(200).json({inquiries ,success:true});
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch inquiries", error: error.message ,success:false});
  }
};

// READ ONE
export const getInquiryById = async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" ,success:false});
    res.status(200).json({inquiry,success:true});
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch inquiry", error: error.message ,success:false});
  }
};

// UPDATE
export const updateInquiry = async (req, res) => {
  try {
    const updated = await Inquiry.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Inquiry not found",success:false });
    res.status(200).json({ message: "Inquiry updated", data: updated ,success:true});
  } catch (error) {
    res.status(500).json({ message: "Failed to update inquiry", error: error.message ,success:false});
  }
};

// DELETE
export const deleteInquiry = async (req, res) => {
  try {
    const deleted = await Inquiry.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Inquiry not found" ,success:false});
    res.status(200).json({ message: "Inquiry deleted",success:true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete inquiry", error: error.message ,success:false});
  }
};
