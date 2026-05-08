export const NovaSimulacao = async (req, res) => {
  try {
    const valor = Number(req.body.valor);
    const meses = Number(req.body.meses);

    if (!valor || valor < 1000) {
      return res.status(400).json({
        message: "Valor mínimo é R$ 1.000,00"
      });
    }

    if (!meses || meses <= 0) {
      return res.status(400).json({
        message: "Informe a quantidade de meses"
      });
    }

    const taxa = 0.03; // 3% ao mês

    // Juros simples
    const rendimento = valor * taxa * meses;
    const total = valor + rendimento;

    return res.status(200).json({
      valor,
      meses,
      taxa: "3% ao mês",
      rendimento,
      total
    });

  } catch (err) {
    return res.status(500).json({
      message: "Erro ao calcular simulação"
    });
  }
};

export const NovaSimulacaoComposta = async (req, res) => {
  try {
    const valor = Number(req.body.valor);

    if (!valor || valor < 1000) {
      return res.status(400).json({
        message: "Valor mínimo é R$ 1.000,00"
      });
    }

    const taxaDiaria = 0.0009786645;

    const periodos = [
      { meses: 12, anos: 1 },
      { meses: 24, anos: 2 },
      { meses: 48, anos: 4 },
      { meses: 60, anos: 5 }
    ];

    const resultados = periodos.map((periodo) => {
      const dias = periodo.meses * 365 / 12;

      const total = valor * Math.pow(1 + taxaDiaria, dias);
      const rendimento = total - valor;

      return {
        meses: periodo.meses,
        anos: periodo.anos,
        valorInicial: Number(valor.toFixed(2)),
        rendimento: Number(rendimento.toFixed(2)),
        total: Number(total.toFixed(2))
      };
    });

    return res.status(200).json({
      tipo: "Juros compostos",
    //   taxa: "Aproximadamente 0,0978% ao dia",
      resultados
    });

  } catch (err) {
    return res.status(500).json({
      message: "Erro ao calcular simulação composta"
    });
  }
};


