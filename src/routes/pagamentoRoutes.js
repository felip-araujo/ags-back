import express from "express";
import {
    criarPagamentoPix,
    consultarStatusPagamento,
    mercadoPagoWebhook,
} from "../controllers/pagamentoController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/pix", authMiddleware, criarPagamentoPix);
router.get("/:id/status", authMiddleware, consultarStatusPagamento);
router.post("/webhooks/mercadopago", mercadoPagoWebhook);

export default router;