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


function calcularPrevisaoAporte(valor, modalidade, meses) {
  const valorNumber = Number(valor);
  const mesesNumber = Number(meses);

  if (modalidade === "JUROS_SIMPLES") {
    const taxa = 0.03;
    const rendimento = valorNumber * taxa * mesesNumber;
    const total = valorNumber + rendimento;

    return {
      modalidade,
      meses: mesesNumber,
      taxa: "3% ao mês",
      rendimento: Number(rendimento.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  }

  if (modalidade === "JUROS_COMPOSTOS") {
    const taxaDiaria = 0.0009786645;
    const dias = (mesesNumber * 365) / 12;

    const total = valorNumber * Math.pow(1 + taxaDiaria, dias);
    const rendimento = total - valorNumber;

    return {
      modalidade,
      meses: mesesNumber,
      anos: mesesNumber / 12,
      taxa: "Aproximadamente 0,0978% ao dia",
      rendimento: Number(rendimento.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  }

  throw new Error("Modalidade de aporte inválida.");
}



export const criarPagamentoPix = async (req, res) => {
  try {
    const { valor, email, nome, modalidade, meses } = req.body;

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

    const modalidadesPermitidas = ["JUROS_SIMPLES", "JUROS_COMPOSTOS"];

    if (!modalidadesPermitidas.includes(modalidade)) {
      return res.status(400).json({
        message:
          "Informe uma modalidade válida: JUROS_SIMPLES ou JUROS_COMPOSTOS.",
      });
    }

    const mesesNumber = Number(meses);

    if (!mesesNumber || mesesNumber <= 0) {
      return res.status(400).json({
        message: "Informe o prazo do aporte.",
      });
    }

    if (modalidade === "JUROS_COMPOSTOS") {
      const periodosPermitidos = [12, 24, 48, 60];

      if (!periodosPermitidos.includes(mesesNumber)) {
        return res.status(400).json({
          message: "Para juros compostos, escolha 1, 2, 4 ou 5 anos.",
        });
      }
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
          message: "Usuário PF não encontrado. Faça login novamente.",
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
          message: "Empresa PJ não encontrada. Faça login novamente.",
        });
      }

      companyId = Number(conta.id);
    }

    if (!conta) {
      return res.status(400).json({
        message: "Conta não encontrada para gerar o pagamento.",
      });
    }

    if (!userId && !companyId) {
      return res.status(400).json({
        message: "Tipo de conta inválido para vincular o pagamento.",
      });
    }

    const valorNumber = formatarValor(valor);

    if (valorNumber < 1000) {
      return res.status(400).json({
        message: "Valor mínimo é R$ 1.000,00.",
      });
    }

    const previsao = calcularPrevisaoAporte(
      valorNumber,
      modalidade,
      mesesNumber
    );

    const payerEmail = email || conta?.email || req.user?.email;

    if (!payerEmail) {
      return res.status(400).json({
        message: "Informe um e-mail para gerar o pagamento.",
      });
    }

    const externalReference = gerarReferenciaExterna();
    const idempotencyKey = crypto.randomUUID();

    const nomePagador =
      nome ||
      conta?.nome ||
      conta?.representante ||
      (tipoConta === "COMPANY" ? "Empresa Investidora" : "Investidor");

    const isPublicApiUrl =
      process.env.API_PUBLIC_URL &&
      !process.env.API_PUBLIC_URL.includes("localhost") &&
      !process.env.API_PUBLIC_URL.includes("127.0.0.1");

    const body = {
      transaction_amount: valorNumber,
      description: `Aporte - ${modalidade === "JUROS_SIMPLES" ? "Juros simples" : "Juros compostos"
        }`,
      payment_method_id: "pix",
      external_reference: externalReference,
      date_of_expiration: calcularExpiracaoPixEmISO(60),
      payer: {
        email: payerEmail,
        first_name: nomePagador,
      },
      metadata: {
        tipo: "investimento",
        tipo_conta: tipoConta,
        modalidade,
        meses: mesesNumber,
        provider: "mercadopago",
      },
    };

    if (isPublicApiUrl) {
      body.notification_url = `${process.env.API_PUBLIC_URL}/webhooks/mercadopago`;
    }

    console.log("Payload Mercado Pago:", JSON.stringify(body, null, 2));

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

    const resultado = await prisma.$transaction(async (tx) => {
      const pagamento = await tx.investimentoPagamento.create({
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
            modalidade,
            meses: mesesNumber,
            previsao,
          },
        },
      });

      const aporte = await tx.aporte.create({
        data: {
          valor: valorNumber,
          tipo: "PIX",
          modalidade,
          meses: mesesNumber,
          taxa: previsao.taxa,
          rendimentoEstimado: previsao.rendimento,
          totalEstimado: previsao.total,
          status: "PENDENTE",

          userId,
          companyId,

          pagamentoId: pagamento.id,
        },
      });

      return {
        pagamento,
        aporte,
      };
    });

    return res.status(201).json({
      message: "Pagamento Pix gerado com sucesso.",
      pagamento: {
        id: resultado.pagamento.id,
        valor: Number(resultado.pagamento.valor),
        status: resultado.pagamento.status,
        tipoConta,
        userId: resultado.pagamento.userId,
        companyId: resultado.pagamento.companyId,
        mercadoPagoPaymentId: resultado.pagamento.mercadoPagoPaymentId,
        qrCodeBase64: resultado.pagamento.qrCodeBase64,
        qrCode: resultado.pagamento.qrCode,
        ticketUrl: resultado.pagamento.ticketUrl,
      },
      aporte: {
        id: resultado.aporte.id,
        valor: resultado.aporte.valor,
        tipo: resultado.aporte.tipo,
        modalidade: resultado.aporte.modalidade,
        meses: resultado.aporte.meses,
        taxa: resultado.aporte.taxa,
        rendimentoEstimado: resultado.aporte.rendimentoEstimado,
        totalEstimado: resultado.aporte.totalEstimado,
        status: resultado.aporte.status,
      },
      simulacao: previsao,
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