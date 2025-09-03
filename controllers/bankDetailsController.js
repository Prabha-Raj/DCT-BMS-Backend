import BankDetails from '../model/BankDetails.js';

// Add or update bank details for a librarian
export const upsertBankDetails = async (req, res) => {
  try {
    const { accountHolderName, accountNumber, ifscCode, bankName, upiId } = req.body;
    const { libraryId } = req.params;
    if (!libraryId || !accountHolderName || !accountNumber || !ifscCode || !bankName) {
      return res.status(400).json({ error: 'All required fields must be provided.' });
    }
    const details = await BankDetails.findOneAndUpdate(
      { library: libraryId },
      {
        accountHolderName,
        accountNumber,
        ifscCode,
        bankName,
        upiId,
        updatedAt: new Date()
      },
      { new: true, upsert: true }
    );
    return res.json(details);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get bank details by librarian ID
export const getBankDetailsById = async (req, res) => {
  try {
  const { libraryId } = req.params;
  const details = await BankDetails.findOne({ library: libraryId });
  if (!details) return res.status(404).json({ error: 'Bank details not found' });
  return res.json(details);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
