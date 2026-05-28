import prisma from "../services/prismaClient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const loginUser = async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({
        message: "Email e senha são obrigatórios",
      });
    }

    const emailNormalizado = email.trim().toLowerCase();

    let account = null;
    let tipoConta = null;

    // Primeiro procura como Pessoa Física
    const user = await prisma.user.findUnique({
      where: {
        email: emailNormalizado,
      },
    });

    if (user) {
      account = user;
      tipoConta = "USER";
    }

    // Se não encontrou PF, procura como Pessoa Jurídica
    if (!account) {
      const company = await prisma.company.findUnique({
        where: {
          email: emailNormalizado,
        },
      });

      if (company) {
        account = company;
        tipoConta = "COMPANY";
      }
    }

    if (!account || !tipoConta) {
      return res.status(401).json({
        message: "Email ou senha inválidos",
      });
    }

    const senhaValida = await bcrypt.compare(senha, account.password);

    if (!senhaValida) {
      return res.status(401).json({
        message: "Email ou senha inválidos",
      });
    }

    const token = jwt.sign(
      {
        sub: account.id,
        id: account.id,
        email: account.email,
        nivel: account.nivel,
        tipoConta,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    return res.status(200).json({
      message: "Login realizado com sucesso",
      token,
      account: {
        id: account.id,
        nome: account.nome || null,
        representante: account.representante || null,
        email: account.email,
        nivel: account.nivel,
        tipoConta,
      },
    });
  } catch (error) {
    console.error("ERRO AO REALIZAR LOGIN:", error);

    return res.status(500).json({
      message: "Erro ao realizar login",
      error: error.message,
    });
  }
};