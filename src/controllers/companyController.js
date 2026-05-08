import prisma from "../services/prismaClient.js";
import bcrypt from "bcryptjs";

// 🔹 GET ALL COMPANIES
export const getAllCompanies = async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        nome: true,
        representante: true,
        email: true,
        cnpj: true,
        telefone: true,
        nivel: true,
        aportes: true,
      },
      orderBy: {
        id: "desc",
      },
    });

    return res.status(200).json(companies);
  } catch (err) {
    console.error("ERRO AO BUSCAR EMPRESAS:", err);

    return res.status(500).json({
      message: "Erro ao buscar empresas",
      error: err.message,
    });
  }
};

// 🔹 GET COMPANY BY ID
export const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;

    const company = await prisma.company.findUnique({
      where: {
        id: Number(id),
      },
      select: {
        id: true,
        nome: true,
        representante: true,
        email: true,
        cnpj: true,
        telefone: true,
        nivel: true,
        aportes: true,
      },
    });

    if (!company) {
      return res.status(404).json({
        message: "Empresa não encontrada",
      });
    }

    return res.status(200).json(company);
  } catch (err) {
    console.error("ERRO AO BUSCAR EMPRESA:", err);

    return res.status(500).json({
      message: "Erro ao buscar empresa",
      error: err.message,
    });
  }
};

// 🔹 CREATE COMPANY
export const createCompany = async (req, res) => {
  try {
    const { nome, representante, email, cnpj, senha, telefone, nivel } = req.body;

    if (!nome || !email || !representante || !cnpj || !senha || !telefone) {
      return res.status(400).json({
        message: "Todos os campos são obrigatórios",
      });
    }

    const companyEmailExist = await prisma.company.findUnique({
      where: {
        email,
      },
    });

    if (companyEmailExist) {
      return res.status(400).json({
        message: "Email já cadastrado",
      });
    }

    const cnpjExist = await prisma.company.findUnique({
      where: {
        cnpj: String(cnpj),
      },
    });

    if (cnpjExist) {
      return res.status(400).json({
        message: "CNPJ já cadastrado",
      });
    }

    const hashSenha = await bcrypt.hash(senha, 10);

    const company = await prisma.company.create({
      data: {
        nome,
        representante,
        email,
        cnpj: String(cnpj),
        password: hashSenha,
        telefone: String(telefone),
        nivel: nivel || "CLIENTE",
      },
      select: {
        id: true,
        nome: true,
        representante: true,
        email: true,
        cnpj: true,
        telefone: true,
        nivel: true,
      },
    });

    return res.status(201).json({
      message: "Empresa criada com sucesso",
      company,
    });
  } catch (err) {
    console.error("ERRO AO CRIAR EMPRESA:", err);

    return res.status(500).json({
      message: "Erro ao criar empresa",
      error: err.message,
    });
  }
};

// 🔹 UPDATE COMPANY
export const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, representante, email, cnpj, senha, telefone, nivel } = req.body;

    const companyExist = await prisma.company.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!companyExist) {
      return res.status(404).json({
        message: "Empresa não encontrada",
      });
    }

    if (email && email !== companyExist.email) {
      const emailExist = await prisma.company.findUnique({
        where: {
          email,
        },
      });

      if (emailExist) {
        return res.status(400).json({
          message: "Email já cadastrado",
        });
      }
    }

    if (cnpj && String(cnpj) !== companyExist.cnpj) {
      const cnpjExist = await prisma.company.findUnique({
        where: {
          cnpj: String(cnpj),
        },
      });

      if (cnpjExist) {
        return res.status(400).json({
          message: "CNPJ já cadastrado",
        });
      }
    }

    let hashSenha;

    if (senha) {
      hashSenha = await bcrypt.hash(senha, 10);
    }

    const company = await prisma.company.update({
      where: {
        id: Number(id),
      },
      data: {
        nome: nome ?? companyExist.nome,
        representante: representante ?? companyExist.representante,
        email: email ?? companyExist.email,
        cnpj: cnpj ? String(cnpj) : companyExist.cnpj,
        telefone: telefone ? String(telefone) : companyExist.telefone,
        nivel: nivel ?? companyExist.nivel,
        password: hashSenha ?? companyExist.password,
      },
      select: {
        id: true,
        nome: true,
        representante: true,
        email: true,
        cnpj: true,
        telefone: true,
        nivel: true,
      },
    });

    return res.status(200).json({
      message: "Empresa atualizada com sucesso",
      company,
    });
  } catch (err) {
    console.error("ERRO AO ATUALIZAR EMPRESA:", err);

    return res.status(500).json({
      message: "Erro ao atualizar empresa",
      error: err.message,
    });
  }
};

// 🔹 DELETE COMPANY
export const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    const companyExist = await prisma.company.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!companyExist) {
      return res.status(404).json({
        message: "Empresa não encontrada",
      });
    }

    await prisma.company.delete({
      where: {
        id: Number(id),
      },
    });

    return res.status(200).json({
      message: "Empresa deletada com sucesso",
    });
  } catch (err) {
    console.error("ERRO AO DELETAR EMPRESA:", err);

    return res.status(500).json({
      message: "Erro ao deletar empresa",
      error: err.message,
    });
  }
};