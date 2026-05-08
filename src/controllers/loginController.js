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

    // 🔹 Primeiro procura na tabela User
    let account = await prisma.user.findUnique({
      where: { email },
    });

    let tipo = "USER";

    // 🔹 Se não encontrar em User, procura na tabela Company
    if (!account) {
      account = await prisma.company.findUnique({
        where: { email },
      });

      tipo = "COMPANY";
    }

    // 🔹 Se não encontrou em nenhuma tabela
    if (!account) {
      return res.status(401).json({
        message: "Email ou senha inválidos",
      });
    }

    // 🔹 Verifica senha
    const senhaValida = await bcrypt.compare(senha, account.password);

    if (!senhaValida) {
      return res.status(401).json({
        message: "Email ou senha inválidos",
      });
    }

    // 🔹 Gera token
    const token = jwt.sign(
      {
        id: account.id,
        email: account.email,
        nivel: account.nivel,
        tipo,
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
        nome: account.nome,
        representante: account.representante || null,
        email: account.email,
        nivel: account.nivel,
        tipo,
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