import express from "express";
import { getAllCompanies, deleteCompany, createCompany, updateCompany, getCompanyById } from "../controllers/companyController.js";


// import { authMiddleware } from "../middleware/authMiddleware.js";
// import { authorize } from "../middleware/authorize.js";

const router = express.Router();
router.get("/", getAllCompanies);
router.get("/:id", getCompanyById);
router.post("/", createCompany);
router.put("/:id", updateCompany);
router.delete("/:id", deleteCompany);



export default router;