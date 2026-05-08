import express from "express";
import cors from "cors";
import userRoutes from "./src/routes/userRoutes.js"
import loginRoutes from "./src/routes/loginRoutes.js"
import simulacaoRoutes from "./src/routes/simulacaoRutes.js"
import empresasRoutes from "./src/routes/companyRoutes.js"

const app = express()
app.use(express.json())

const allowedOrigins = [
  "http://localhost:5174",
  "https://agsinvest.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Não permitido pelo CORS"));
      }
    },
    credentials: true,
  })
);


app.use("/users", userRoutes)
app.use("/login", loginRoutes)
app.use("/simulacao", simulacaoRoutes)
app.use("/empresas", empresasRoutes)





app.listen(3000, () => {
    console.log("Server running on port 3000");
});
export default app