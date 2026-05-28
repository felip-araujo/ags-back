import crypto from "node:crypto";
import prisma from "../services/prismaClient.js";

function gerarReferenciaExterna() {
  return `INV-${Date.now()}-${crypto.randomUUID()}`;
}

function formatarValor(valor) {
  const numero = Number(valor);

  if (Number.isNaN(numero) || numero <= 0) {
    throw new Error("Informe um valor de investimento válido.");
  }

  return Number(numero.toFixed(2));
}

function calcularExpiracaoPixEmISO(minutos = 60) {
  const data = new Date();
  data.setMinutes(data.getMinutes() + minutos);
  return data.toISOString();
}

async function consultarPagamentoMercadoPago(paymentId) {
  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("Erro ao consultar pagamento MP:", data);
    throw new Error("Erro ao consultar pagamento no Mercado Pago.");
  }

  return data;
}

export const criarPagamentoPix = async (req, res) => {
  try {
    const { valor, email, nome, cpf, cnpj } = req.body;

    if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
      return res.status(500).json({
        message: "Token do Mercado Pago não configurado.",
      });
    }

    if (!req.user?.id) {
      return res.status(401).json({
        message: "Usuário não autenticado.",
      });
    }

    const tipoConta = req.user.tipoConta || req.user.tipo;

    if (!tipoConta) {
      return res.status(400).json({
        message: "Tipo de conta não identificado. Faça login novamente.",
      });
    }

    let userId = null;
    let companyId = null;
    let conta = null;

    if (tipoConta === "USER") {
      conta = await prisma.user.findUnique({
        where: {
          id: Number(req.user.id),
        },
      });

      if (!conta) {
        return res.status(404).json({
          message: "Usuário PF não encontrado.",
        });
      }

      userId = Number(conta.id);
    }

    if (tipoConta === "COMPANY") {
      conta = await prisma.company.findUnique({
        where: {
          id: Number(req.user.id),
        },
      });

      if (!conta) {
        return res.status(404).json({
          message: "Empresa PJ não encontrada.",
        });
      }

      companyId = Number(conta.id);
    }

    if (!userId && !companyId) {
      return res.status(400).json({
        message: "Tipo de conta inválido para vincular o pagamento.",
      });
    }

    const valorNumber = formatarValor(valor);

    const payerEmail = email || conta.email || req.user.email;

    if (!payerEmail) {
      return res.status(400).json({
        message: "Informe um e-mail para gerar o pagamento.",
      });
    }

    const externalReference = gerarReferenciaExterna();
    const idempotencyKey = crypto.randomUUID();

    const nomePagador =
      nome ||
      conta.nome ||
      conta.representante ||
      (tipoConta === "COMPANY" ? "Empresa Investidora" : "Investidor");

    const body = {
      transaction_amount: valorNumber,
      description: "Investimento na plataforma",
      payment_method_id: "pix",
      external_reference: externalReference,
      date_of_expiration: calcularExpiracaoPixEmISO(60),

      notification_url: process.env.API_PUBLIC_URL
        ? `${process.env.API_PUBLIC_URL}/webhooks/mercadopago`
        : undefined,

      payer: {
        email: payerEmail,
        first_name: nomePagador,
      },

      metadata: {
        tipo: "investimento",
        tipoConta,
        userId,
        companyId,
        pagadorId: Number(req.user.id),
        provider: "mercadopago",
      },
    };

    const documentoCpf = cpf ? String(cpf).replace(/\D/g, "") : null;
    const documentoCnpj = cnpj ? String(cnpj).replace(/\D/g, "") : null;

    if (documentoCpf) {
      body.payer.identification = {
        type: "CPF",
        number: documentoCpf,
      };
    }

    if (documentoCnpj) {
      body.payer.identification = {
        type: "CNPJ",
        number: documentoCnpj,
      };
    }

    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    const payment = await response.json();

    if (!response.ok) {
      console.error("Erro Mercado Pago:", payment);

      return res.status(response.status).json({
        message: "Erro ao gerar pagamento Pix.",
        mercadoPagoError: payment,
      });
    }

    const transactionData =
      payment?.point_of_interaction?.transaction_data || {};

    const pagamento = await prisma.investimentoPagamento.create({
      data: {
        valor: valorNumber,
        status: payment.status || "pending",

        mercadoPagoPaymentId: String(payment.id),
        externalReference,

        qrCodeBase64: transactionData.qr_code_base64 || null,
        qrCode: transactionData.qr_code || null,
        ticketUrl: transactionData.ticket_url || null,

        payerEmail,
        descricao: "Investimento na plataforma",

        userId,
        companyId,

        metadata: {
          mercadoPagoStatusDetail: payment.status_detail || null,
          idempotencyKey,
          tipoConta,
          pagadorId: Number(req.user.id),
          provider: "mercadopago",
          mercadoPagoPaymentId: String(payment.id),
        },
      },
    });

    return res.status(201).json({
      message: "Pagamento Pix gerado com sucesso.",
      pagamento: {
        id: pagamento.id,
        valor: Number(pagamento.valor),
        status: pagamento.status,
        tipoConta,
        userId: pagamento.userId,
        companyId: pagamento.companyId,
        mercadoPagoPaymentId: pagamento.mercadoPagoPaymentId,
        qrCodeBase64: pagamento.qrCodeBase64,
        qrCode: pagamento.qrCode,
        ticketUrl: pagamento.ticketUrl,
      },
    });
  } catch (err) {
    console.error("Erro ao criar pagamento Pix:", err);

    return res.status(400).json({
      message: err.message || "Erro ao criar pagamento Pix.",
    });
  }
};

export const consultarStatusPagamento = async (req, res) => {
  try {
    const { id } = req.params;

    const pagamento = await prisma.investimentoPagamento.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!pagamento) {
      return res.status(404).json({
        message: "Pagamento não encontrado.",
      });
    }

    const payment = await consultarPagamentoMercadoPago(
      pagamento.mercadoPagoPaymentId
    );

    const pagamentoAtualizado = await prisma.investimentoPagamento.update({
      where: {
        id: pagamento.id,
      },
      data: {
        status: payment.status || pagamento.status,
        metadata: {
          mercadoPagoStatusDetail: payment.status_detail || null,
          dateApproved: payment.date_approved || null,
          lastUpdate: payment.date_last_updated || null,
        },
      },
    });

    return res.status(200).json({
      pagamento: {
        id: pagamentoAtualizado.id,
        valor: Number(pagamentoAtualizado.valor),
        status: pagamentoAtualizado.status,
        mercadoPagoPaymentId: pagamentoAtualizado.mercadoPagoPaymentId,
      },
    });
  } catch (err) {
    console.error("Erro ao consultar pagamento:", err);

    return res.status(500).json({
      message: "Erro ao consultar pagamento.",
    });
  }
};

export const mercadoPagoWebhook = async (req, res) => {
  try {
    const paymentId =
      req.body?.data?.id ||
      req.body?.id ||
      req.query?.["data.id"] ||
      req.query?.id;

    if (!paymentId) {
      return res.status(200).json({
        message: "Webhook recebido sem paymentId.",
      });
    }

    const payment = await consultarPagamentoMercadoPago(paymentId);

    await prisma.investimentoPagamento.updateMany({
      where: {
        mercadoPagoPaymentId: String(payment.id),
      },
      data: {
        status: payment.status || "pending",
        metadata: {
          mercadoPagoStatusDetail: payment.status_detail || null,
          dateApproved: payment.date_approved || null,
          lastUpdate: payment.date_last_updated || null,
          webhookReceivedAt: new Date().toISOString(),
        },
      },
    });

    return res.status(200).json({
      received: true,
    });
  } catch (err) {
    console.error("Erro no webhook Mercado Pago:", err);

    return res.status(200).json({
      received: true,
    });
  }
};