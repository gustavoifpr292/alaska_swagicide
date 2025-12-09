import { getDocs, getDoc, collection, query, orderBy, documentId, setDoc, doc, deleteDoc, updateDoc, where, getCountFromServer } from "firebase/firestore";
import db from "../db/firebase.js";

export async function obterAmostras(req, res) {
    try {
        const {
            page = 1,
                limit = 10,
                search = '',
                status = '',
                cultura = '',
                dataInicio = '',
                dataFim = '',
                produtor = '',
                fazenda = ''
        } = req.query;

        // Construir query base
        let q = collection(db, "amostras");
        let constraints = [];

        // Filtro por instituição (se não for ADM)
        if (!req.isADM) {
            constraints.push(where("idInstituicao", "==", req.user.instituicaoEscolhida.id));
        }

        // Filtro por status
        if (status) {
            constraints.push(where("status", "==", status));
        }

        // Filtro por cultura
        if (cultura) {
            constraints.push(where("cultura", "==", cultura));
        }

        if (produtor) {
            constraints.push(where("idProdutor", "==", produtor));
        }

        if (fazenda) {
            constraints.push(where("idFazenda", "==", fazenda));
        }

        // Filtro por data
        if (dataInicio || dataFim) {
            if (dataInicio && dataFim) {
                constraints.push(where("dataColeta", ">=", dataInicio));
                constraints.push(where("dataColeta", "<=", dataFim));
            } else if (dataInicio) {
                constraints.push(where("dataColeta", ">=", dataInicio));
            } else if (dataFim) {
                constraints.push(where("dataColeta", "<=", dataFim));
            }
        }

        // Aplicar filtros
        if (constraints.length > 0) {
            q = query(q, ...constraints);
        }

        // Ordenação
        q = query(q, orderBy("dataColeta", "desc"));

        // Executar query
        const snapshot = await getDocs(q);

        // Aplicar filtro de busca textual (por ID) APÓS a query do Firestore
        let amostrasFiltradas = [];

        for (const documento of snapshot.docs) {
            amostrasFiltradas.push({
                id: documento.id,
                ...documento.data(),
                parametrosSolicitados: await obterParametrosSolicitados(documento.id)
            });
        }

        // Filtro de busca textual (por ID) - feito manualmente
        if (search) {
            const searchLower = search.toLowerCase();
            amostrasFiltradas = amostrasFiltradas.filter(amostra =>
                amostra.id.toLowerCase().includes(searchLower)
            );
        }

        const total = amostrasFiltradas.length;

        // Calcular paginação
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);

        // Aplicar paginação
        const amostrasPaginadas = req.noPages ? amostrasFiltradas : amostrasFiltradas.slice(startIndex, endIndex);

        res.json({
            amostras: amostrasPaginadas,
            paginacao: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao buscar amostras" });
    }
}

export async function obterAmostrasInterno(req) {
    try {
        const {
            page = 1,
                limit = 10,
                search = '',
                status = '',
                cultura = '',
                dataInicio = '',
                dataFim = '',
                produtor = '',
                fazenda = ''
        } = req.query;

        // Construir query base
        let q = collection(db, "amostras");
        let constraints = [];

        // Filtro por instituição (se não for ADM)
        if (!req.isADM) {
            constraints.push(where("idInstituicao", "==", req.user.instituicaoEscolhida.id));
        }

        // Filtro por status
        if (status) {
            constraints.push(where("status", "==", status));
        }

        // Filtro por cultura
        if (cultura) {
            constraints.push(where("cultura", "==", cultura));
        }

        if (produtor) {
            constraints.push(where("idProdutor", "==", produtor));
        }

        if (fazenda) {
            constraints.push(where("idFazenda", "==", fazenda));
        }

        // Filtro por data
        if (dataInicio || dataFim) {
            if (dataInicio && dataFim) {
                constraints.push(where("dataColeta", ">=", dataInicio));
                constraints.push(where("dataColeta", "<=", dataFim));
            } else if (dataInicio) {
                constraints.push(where("dataColeta", ">=", dataInicio));
            } else if (dataFim) {
                constraints.push(where("dataColeta", "<=", dataFim));
            }
        }

        // Aplicar filtros
        if (constraints.length > 0) {
            q = query(q, ...constraints);
        }

        // Ordenação
        q = query(q, orderBy("dataColeta", "desc"));

        // Executar query
        const snapshot = await getDocs(q);

        // Aplicar filtro de busca textual (por ID) APÓS a query do Firestore
        let amostrasFiltradas = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Filtro de busca textual (por ID) - feito manualmente
        if (search) {
            const searchLower = search.toLowerCase();
            amostrasFiltradas = amostrasFiltradas.filter(amostra =>
                amostra.id.toLowerCase().includes(searchLower)
            );
        }

        const total = amostrasFiltradas.length;

        // Calcular paginação
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);

        // Aplicar paginação
        const amostrasPaginadas = req.noPages ? amostrasFiltradas : amostrasFiltradas.slice(startIndex, endIndex);

        return {
            amostras: amostrasPaginadas,
            paginacao: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        };
    } catch (err) {
        console.error(err);
        return {};
    }
}

export async function contarAmostras(req, res) {
    try {
        let queryBase = req.isADM ? collection(db, "amostras") : query(collection(db, "amostras"), where("idInstituicao", "==", req.user.instituicaoEscolhida.id));

        const total = (await getCountFromServer(queryBase)).data().count;
        const pendentes = (await getCountFromServer(query(queryBase, where("status", "==", "Pendente")))).data().count;
        const analisadas = (await getCountFromServer(query(queryBase, where("status", "==", "Analisado")))).data().count;

        res.json({ total, pendentes, analisadas });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao contar amostras" });
    }
}

export async function contarAmostrasInterno(req) {
    try {
        let queryBase = req.isADM ? collection(db, "amostras") : query(collection(db, "amostras"), where("idInstituicao", "==", req.user.instituicaoEscolhida.id));

        const total = (await getCountFromServer(queryBase)).data().count;
        const pendentes = (await getCountFromServer(query(queryBase, where("status", "==", "Pendente")))).data().count;
        const analisadas = (await getCountFromServer(query(queryBase, where("status", "==", "Analisado")))).data().count;

        return { total, pendentes, analisadas };
    } catch (err) {
        console.error(err);
        return { total: 0, pendentes: 0, analisadas: 0 };
    }
}

export async function obterAmostra(req, res) {
    try {
        const id = req.params.id;

        const amostra = {
            id,
            ...req.object,
            parametrosSolicitados: await obterParametrosSolicitados(id)
        }

        res.json(amostra);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao buscar amostra" });
    }
}

export async function cadastrarAmostra(req, res) {
    try {
        const amostra = req.body;
        let { id } = req.params;

        if (!amostra) return res.status(400).json({ error: "Dados inválidos" });

        const temId = id ? true : false;

        //console.log(temId);

        id = temId ? id : await calcularId();

        const { parametrosSolicitados } = amostra;

        if (temId) {
            const snapshotParametrosAmostra = await getDocs(query(collection(db, "amostras_parametros"), where("idAmostra", "==", id)));
            const parametrosRemover = [];

            for (const documento of snapshotParametrosAmostra.docs) {
                const parametro = {id: documento.id, ...documento.data()};

                if (!parametrosSolicitados.includes(parametro)) parametrosRemover.push(parametro);                 
            }

            console.log(parametrosRemover);
            console.log(parametrosSolicitados);

            for (const parametro of parametrosRemover) {
                await deleteDoc(doc(db, "amostras_parametros", parametro.id));
            }

            for (const parametro of parametrosSolicitados) {
                const idParametro = parametro.id;
                delete parametro.id;
                await setDoc(doc(db, "amostras_parametros", idParametro), parametro);
            }
        } else {
            for (const parametro of parametrosSolicitados) {
                const idParametro = parametro.id;
                delete parametro.id;
                await setDoc(doc(db, "amostras_parametros", `${id}_${idParametro}`), {
                    idParametro,
                    idAmostra: id,
                    nome: parametro.nome,
                    tipo: parametro.tipo,
                    unidade: parametro.unidade
                })
            }
        }

        delete amostra.parametrosSolicitados;

        await setDoc(doc(db, "amostras", id), amostra);

        res.status(201).json({ sucess: true, amostra });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao cadastrar amostra" });
    }
}

//curl -X POST -H "Content-Type: application/json" -d "{\"data\":\"outrodia\", \"idUsuario\":\"US-2025-0001\", \"origem\":\"Melandia\", \"status\":\"Pendente\"}" localhost:3000/amostras

export async function editarAmostra(req, res) {
    try {
        const { id } = req.params;
        const alteracoes = req.body;
        const amostra = req.object;

        if (amostra.status != "Pendente" && !req.isADM) return res.status(402).json({ message: "A amostra não pode mais ser editada" });

        const { parametrosSolicitados } = alteracoes;

        const snapshotParametrosAmostra = await getDocs(query(collection(db, "amostras_parametros"), where("idAmostra", "==", id)));
        const parametrosRemover = [];

        for (const documento of snapshotParametrosAmostra.docs) {
            const parametro = {id: documento.id, ...documento.data()};

            if (!parametrosSolicitados.includes(parametro)) parametrosRemover.push(parametro);              
        }

        //console.log(parametrosRemover);
        //console.log(parametrosSolicitados);

        for (const parametro of parametrosRemover) {
            await deleteDoc(doc(db, "amostras_parametros", parametro.id));
        }

        for (const parametro of parametrosSolicitados) {
            const idParametro = parametro.id;
            delete parametro.id;
            await setDoc(doc(db, "amostras_parametros", `${id}_${idParametro}`), {idAmostra: id, idParametro, ...parametro});
        }
    
        delete amostra.parametrosSolicitados;
        await updateDoc(doc(db, "amostras", id), alteracoes);

        res.status(201).json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao editar amostra" });
    }
}

//curl -X PUT -H "Content-Type: application/json" -d "{\"data\":\"algumdia\", \"idUsuario\":\"US-2025-0001\", \"origem\":\"Melandia\", \"status\":\"Analisado\"}" localhost:3000/amostras/AM-2025-0002

export async function excluirAmostra(req, res) {
    try {
        const { id } = req.params;
        const amostra = req.object;

        if (amostra.status != "Pendente") return res.status(402).json({ message: "A amostra não pode mais ser excluída" });

        const docRef = doc(db, "amostras", id);
        await deleteDoc(docRef);
        res.json({ sucess: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao excluir amostra" });
    }
}
//curl -X DELETE localhost:3000/amostras/AM-2025-0003

async function obterParametrosSolicitados(id) {
    try {
        const snapshot = await getDocs(query(collection(db, "amostras_parametros"), where("idAmostra", "==", id)));

        const parametros = [];

        for (const documento of snapshot.docs) {
            parametros.push({
                id: documento.id,
                ...documento.data()
            });
        }

        return parametros;
    } catch (err) {
        console.error(err);
    }
}

async function calcularId() {
    try {
        const snapshot = await getDocs(collection(db, "amostras"));
        let maior = 0;

        snapshot.forEach(doc => {
            const id = doc.id;
            const partes = id.split("-");
            const numero = parseInt(partes[2], 10);

            if (numero > maior) {
                maior = numero;
            }
        });

        const novoId = (maior + 1).toString().padStart(4, "0");
        const ano = new Date().getFullYear();
        return `AM-${ano}-${novoId}`;
    } catch (err) {
        console.error(err);
    }
}