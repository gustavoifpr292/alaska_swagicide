import express from "express";
import rotaAmostras from "./routes/routesAmostras.js";
import rotaAnalises from "./routes/routesAnalises.js";
import rotaLaudos from "./routes/routesLaudos.js";
import rotaParametros from "./routes/routesParametros.js";
import rotaMiddleware from "./routes/routesMiddleware.js";
import rotaUsers from "./routes/routesUsers.js";
import rotaFazendas from "./routes/routesFazendas.js";
import rotaInstituicoes from "./routes/routesInstituicoes.js";
import rotaDashboard from "./routes/routesDashboard.js";
import path from 'path';
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//console.log(path.join(__dirname, '../AQMelAPP'));

app.use(express.json());

app.use(express.static(path.join(__dirname, '../AQMelAPP')));

const PORT = process.env.PORT || 3000;

//Rotas da API
app.use('/', rotaAmostras);
app.use('/', rotaAnalises);
app.use('/', rotaLaudos);
app.use('/', rotaParametros);
app.use('/', rotaMiddleware);
app.use('/', rotaUsers);
app.use('/', rotaFazendas);
app.use('/', rotaInstituicoes);
app.use('/', rotaDashboard);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../AQMelAPP/index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
})