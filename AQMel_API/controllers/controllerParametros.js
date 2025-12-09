import { getDocs, getDoc, collection, query, orderBy, documentId, setDoc, doc, deleteDoc, Timestamp, where, updateDoc } from "firebase/firestore";
import db from "../db/firebase.js";

export async function obterParametros(req, res) {
  try {
    const snapshot = await getDocs(query(collection(db, "parametros"), where("idInstituicao", "==", req.user.instituicaoEscolhida.id)));
    
    const parametros = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(parametros);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar parâmetros" });
  }
}

export async function obterParametro(req, res) {
  try {
    const { id } = req.params;
    const snapshot = await getDoc(doc(db, "parametros", id));

    if (!snapshot.exists()) return res.status(404).json({ error: "Parâmetro não existe" });

    const parametro = {
      id,
      ...snapshot.data(),
    };

    res.json(parametro);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar parâmetro" });
  }
}

export async function cadastrarParametro(req, res) {
  try {
    const parametro = req.body;
    let { id } = req.params;

    if (!parametro) return res.status(400).json({ error: "Dados inválidos" });
    
    id = id ?? await calcularId(req.user.instituicaoEscolhida.id);

    await setDoc(doc(db, "parametros", id), parametro);
    
    res.status(201).json({ sucess: true, parametro });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao cadastrar parâmetro" });
  }
}

export async function editarParametro(req, res) {
  try {
    const { id } = req.params;
    const alteracoes = req.body;
    
    await updateDoc(doc(db, "parametros", id), alteracoes);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao editar parâmetro" });
  }
}

export async function excluirParametro(req, res) {
  try {
    const { id } = req.params;
    const docRef = doc(db, "parametros", id);
    await deleteDoc(docRef);
    res.json({ sucess: true });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao excluir parâmetro" });
  }
} 

async function calcularId(idInstituicao) {
  try {
    const snapshot = await getDocs(query(collection(db, "parametros"), where("idInstituicao", "==", idInstituicao)));
    let maior = 0;

    snapshot.forEach(doc => {
      const id = doc.id;
      const partes = id.split("-");
      const numero = parseInt(partes[2], 10);

      if (numero > maior) {
        maior = numero;
      }
    });
    
    const numInstituicao = idInstituicao.split("-")[1];
    const novoId = (maior + 1).toString().padStart(2, "0");
    return `PR-${numInstituicao}-${novoId}`;
  } catch(err) {
    console.error(err);
  }
}