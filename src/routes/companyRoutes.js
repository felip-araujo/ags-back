import express from "express";
import { getAllCompanies, deleteCompany, createCompany, updateCompany, getCompanyById } from "../controllers/companyController.js";


import { authMiddleware } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authorize.js";

const router = express.Router();
router.get("/", authMiddleware, authorize("ADMIN"), getAllCompanies);
router.get("/:id", authMiddleware, authorize("ADMIN"), getCompanyById);
router.post("/", createCompany);
router.put("/:id", authMiddleware, authorize("ADMIN", "CLIENTE"), updateCompany);
router.delete("/:id", authMiddleware, authorize("ADMIN"), deleteCompany);


export default router;