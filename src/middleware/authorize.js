export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.nivel)) {
      return res.status(403).json({
        message: "Acesso negado"
      });
    }

    next();
  };
};