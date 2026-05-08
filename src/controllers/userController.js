import prisma from "../services/prismaClient.js";
import bcrypt from "bcryptjs";


// 🔹 GET ALL USERS
export const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        gender: true,
        cpf: true,
        telefone: true,
        nivel: true,
        aportes: true

      }
    });

    if (users.length === 0) {
      return res.status(404).json({ message: "Nenhum usuário encontrado" });
    }

    return res.status(200).json(users);

  } catch (err) {
    return res.status(500).json({ message: "Erro ao buscar usuários" });
  }
};


// 🔹 GET USER BY ID
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        nivel: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    return res.status(200).json(user);

  } catch (err) {
    return res.status(500).json({ message: "Erro ao buscar usuário" });
  }
};


// 🔹 CREATE USER
export const createUser = async (req, res) => {
  try {
    const { nome, email, cpf, gender, senha, telefone, nivel } = req.body;

    if (!nome || !email || !cpf || !senha || !telefone) {
      return res.status(400).json({
        message: "Todos os campos são obrigatórios",
      });
    }

    const userExist = await prisma.user.findUnique({
      where: { email },
    });

    if (userExist) {
      return res.status(400).json({
        message: "Email já cadastrado",
      });
    }

    const cpfExist = await prisma.user.findUnique({
      where: { cpf: String(cpf) },
    });

    if (cpfExist) {
      return res.status(400).json({
        message: "CPF já cadastrado",
      });
    }

    const hashSenha = await bcrypt.hash(senha, 10);

    const user = await prisma.user.create({
      data: {
        nome,
        email,
        cpf: String(cpf),
        gender: gender || null,
        password: hashSenha,
        telefone: String(telefone),
        nivel: nivel || "CLIENTE",
      },
    });

    return res.status(201).json({
      message: "Usuário criado com sucesso",
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        cpf: user.cpf,
        gender: user.gender,
        telefone: user.telefone,
        nivel: user.nivel,
      },
    });
  } catch (err) {
    console.error("ERRO REAL:", err);

    return res.status(500).json({
      message: "Erro ao criar usuário",
      error: err.message,
    });
  }
};


// 🔹 UPDATE USER
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, telefone } = req.body;

    const userExist = await prisma.user.findUnique({
      where: { id: Number(id) }
    });

    if (!userExist) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: {
        nome: nome ?? userExist.nome,
        email: email ?? userExist.email,
        telefone: telefone ? Number(telefone) : userExist.telefone
      }
    });

    return res.status(200).json({
      message: "Usuário atualizado",
      user: updatedUser
    });

  } catch (err) {
    return res.status(500).json({ message: "Erro ao atualizar usuário" });
  }
};


// 🔹 DELETE USER
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const userExist = await prisma.user.findUnique({
      where: { id: Number(id) }
    });

    if (!userExist) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    await prisma.user.delete({
      where: { id: Number(id) }
    });

    return res.status(200).json({
      message: "Usuário deletado com sucesso"
    });

  } catch (err) {
    return res.status(500).json({ message: "Erro ao deletar usuário" });
  }
};