const Client = require("../models/Client");
const Invoice = require("../models/Invoice");

const createClient = async (req, res) => {
  try {
    const client = await Client.create(req.body);
    res.status(201).json({ success: true, client });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllClients = async (req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, clients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.status(200).json({ success: true, client });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteClient = async (req, res) => {
  try {
    await Client.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Client deleted." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.create(req.body);
    await Client.findByIdAndUpdate(req.body.clientId, {
      $inc: { outstandingBalance: Number(req.body.amount) },
    });
    res.status(201).json({ success: true, invoice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate("clientId", "name company email")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createClient,
  getAllClients,
  updateClient,
  deleteClient,
  createInvoice,
  getAllInvoices,
};