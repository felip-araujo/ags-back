import express from "express";
import { NovaSimulacao, NovaSimulacaoComposta } from "../controllers/SimulacaoController.js";

const router = express.Router();

router.post("/", NovaSimulacao);
router.post("/composto", NovaSimulacaoComposta)

export default router;