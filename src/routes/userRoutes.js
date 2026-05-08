import express from "express";
import {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser
} from "../controllers/userController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authorize.js";
const router = express.Router();

router.get("/", authMiddleware, authorize("ADMIN"), getAllUsers);
router.get("/:id", authMiddleware, authorize("ADMIN", "CLIENTE"), getUserById);
router.post("/", createUser);
router.put("/:id", authMiddleware, authorize("ADMIN", "CLIENTE"), updateUser);
router.delete("/:id", authMiddleware, authorize("ADMIN"), deleteUser);

export default router;