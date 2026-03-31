require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get, onValue, update, set } = require("firebase/database");

// ===============================
// 🛡️ VERIFICAÇÃO DE AMBIENTE
// ===============================
console.log("--------------------------------------------------");
console.log("🔑 STATUS DO TOKEN:", process.env.META_TOKEN ? "✅ OK (DEFINIDO)" : "❌ NÃO DEFINIDO");
console.log("--------------------------------------------------");

const app = express();
app.use(express.json());
app.use(cors());

const META_TOKEN = process.env.META_TOKEN; 

if (!META_TOKEN) {
    console.error("❌ ERRO CRÍTICO: META_TOKEN não definido nas variáveis de ambiente!");
}

const PHONE_ID = '1090608227463192'; 
const VERIFY_TOKEN = 'meu_token_elite'; 

const firebaseConfig = {
    apiKey: "AIzaSyANz1gbAi3PIGwS1-RzOIXF6SUZvS2U0mU",
    databaseURL: "https://agenda-album-de-formatura-default-rtdb.firebaseio.com"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

let projId = "";
let escolaGlobal = "";

const mensagensProcessadas = new Set();

// ===============================
// 📚 CENTRAL DE RESPOSTAS ELITE
// ===============================
const respostasElite = {
    formando: (criança) => `Maravilha, ${criança}! 😊 Como você é o formando, as fotos já estão separadas para você conhecer.\n\nEste atendimento é automatizado.\n\n👇 *CLIQUE AQUI PARA AGENDAR SUA VISITA!* \nhttps://2212785.github.io/Agendamentos`,
    
    responsavel: (criança) => `Entendido! 😊 Como você é o responsável pelo(a) ${criança}, informamos que o material já está pronto.\n\nEste é um contato automático (Atendemos até as 20:30h).\n\n👇 *CLIQUE AQUI PARA AGENDAR SUA VISITA!* \nhttps://2212785.github.io/Agendamentos`,
    
    duvida_quem: (escola) => `Olá 😊\n\nSomos da equipe responsável pelo atendimento automatizado das fotos de formatura da Escola ${escola}.\n\nEste primeiro contato é automático para identificação.\n\nCaso tenha interesse, um representante poderá esclarecer todos os detalhes pessoalmente durante a visita.`,
    
    duvida_motivo: (escola) => `Estamos entrando em contato referente às fotos de formatura da Escola ${escola} 📸\n\nEste é um atendimento inicial automatizado para identificação.\n\nApós sua confirmação, um representante poderá apresentar todos os detalhes pessoalmente durante a visita.`,
    
    duvida_preco: () => `Os valores e condições são apresentados diretamente pelo representante durante a visita 😊\n\nEste atendimento inicial é automatizado apenas para identificação e direcionamento.`,
    
    duvida_agendamento: () => `Este atendimento é automatizado.\n\n👇 *CLIQUE AQUI PARA AGENDAR SUA VISITA!* \nhttps://2212785.github.io/Agendamentos`,
    
    duvida_local: () => `As informações completas sobre local e funcionamento são apresentadas pelo representante no momento da visita 😊\n\nEste primeiro contato é apenas automatizado para identificação.`,
    
    duvida_obrigatorio: () => `Sim 😊\n\nEsta resposta ajuda a identificarmos corretamente se falamos com a pessoa ou responsável.\n\nApós isso, um representante poderá dar continuidade com mais informações durante a visita.`,
    
    duvida_identificacao: (criança) => `Para prosseguirmos 😊\n\nPor favor, responda uma das opções abaixo:\n\n1. Sou o(a) ${criança}\n2. Sou o responsável\n3. Não conheço\n\nEste atendimento é automatizado e servirá apenas para identificação inicial.`,
    
    desculpas: () => `Obrigado pelo retorno 👍\n\nVamos registrar e corrigir nosso contato.\n\nPedimos desculpas pelo inconveniente e agradecemos sua atenção 😊`,
    
    remover: () => `Entendido 👍\n\nVamos registrar seu desinteresse e remover seu número da nossa lista de contatos.\n\nPedimos desculpas pelo incômodo e agradecemos sua atenção 😊`,
    
    depois: () => `Sem problemas 😊\n\nFique à vontade para responder quando puder.`,
    
    humano: () => `Este primeiro atendimento é realizado de forma automatizada 😊\n\nApós sua confirmação, um representante entrará em contato.`,
    
    seguranca: (escola) => `Sim, é confiável! 😊 Este é um atendimento oficial da formatura da Escola ${escola}.`,
    
    audio: () => `Olá! 🤖 Como este atendimento é 100% automatizado, eu **não consigo ouvir áudios**. Por favor, use o link para agendar sua visita:\n👉 https://2212785.github.io/Agendamentos`,
    
    fallback: () => `Olá! 😊 Para seguirmos, por favor, responda com:\n1️⃣ Sim, sou o formando\n2️⃣ Sim, sou o responsável\n3️⃣ Não conheço\n\nOu agende aqui: https://2212785.github.io/Agendamentos`
};

// ===============================
// 📤 FUNÇÃO DE ENVIO
// ===============================
async function enviarMensagemMeta(to, conteudo, tipo = "text") {
    try {
        let data;
        let textoParaFirebase = "";

        if (tipo === "text") {
            data = { messaging_product: "whatsapp", to: to, type: "text", text: { body: conteudo } };
            textoParaFirebase = conteudo;
        } else if (tipo === "template") {
            const nomeFinal = conteudo.criança || "Cliente";
            const escolaFinal = conteudo.escola || escolaGlobal || "sua escola";
            textoParaFirebase = `[TEMPLATE: inicio_contato] Olá ${nomeFinal}, fotos prontas.`;
            data = {
                messaging_product: "whatsapp", to: to, type: "template",
                template: {
                    name: "inicio_contato", language: { code: "pt_BR" },
                    components: [{ type: "body", parameters: [{ type: "text", text: String(nomeFinal) }, { type: "text", text: String(escolaFinal) }] }]
                }
            };
        }

        await axios.post(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, data, {
            headers: { 'Authorization': `Bearer ${META_TOKEN}`, 'Content-Type': 'application/json' }
        });

        const numeroLimpo = to.replace(/\D/g, "");
        await set(ref(db, `respostas/${numeroLimpo}/${Date.now()}`), {
            mensagem: textoParaFirebase, tipo: "BOT", data: new Date().toLocaleString('pt-BR')
        });
    } catch (err) { 
        console.error(`❌ ERRO AO ENVIAR PARA ${to}:`, err.response ? err.response.data : err.message); 
    }
}

// ===============================
// 🚀 ROTA DE DISPARO
// ===============================
app.post('/disparar-template', async (req, res) => {
    const { telefone, nome_formando, escola } = req.body;
    if (!telefone || !nome_formando) return res.status(400).send({ error: "Dados incompletos" });

    try {
        console.log(`📡 Disparo massivo -> Nome: ${nome_formando} | Fone: ${telefone}`);
        await enviarMensagemMeta(telefone, { criança: nome_formando, escola: escola || escolaGlobal }, "template");
        res.status(200).send({ success: true });
    } catch (error) { 
        res.status(500).send({ error: "Erro no disparo massivo" }); 
    }
});

// ===============================
// 🤖 PROCESSAR RESPOSTAS
// ===============================
async function processarMensagemRecebida(from, texto, msgType = "text") {
    const txt = (texto || "").toLowerCase().trim();
    const numeroLimpo = from.replace(/\D/g, "");
    let nomeCriança = "Formando"; 
    let escolaCliente = escolaGlobal || "Escola";

    try {
        const snapshot = await get(ref(db, "enviados"));
        if (snapshot.exists()) {
            const lista = snapshot.val();
            const encontrado = Object.values(lista).find(item => item.telefone && item.telefone.replace(/\D/g, "").includes(numeroLimpo));
            if (encontrado) { 
                nomeCriança = encontrado.criança || encontrado.nome || encontrado.nome_formando || "Formando"; 
                escolaCliente = encontrado.escola || escolaGlobal || "Escola"; 
            }
        }
    } catch (e) { console.error("Erro ao ler Firebase"); }

    let respostaFinal = "";
    if (msgType === "audio") {
        respostaFinal = respostasElite.audio();
    } else {
        if (txt.includes("não quero") || txt.includes("nao quero") || txt.includes("interesse") || txt.includes("remover") || txt.includes("pare")) {
            respostaFinal = respostasElite.remover();
        } else if (txt === "1" || txt.includes("sou eu") || txt === "1️⃣") {
            respostaFinal = respostasElite.formando(nomeCriança);
        } else if (txt === "2" || txt.includes("responsavel") || txt === "2️⃣") {
            respostaFinal = respostasElite.responsavel(nomeCriança);
        } else if (txt === "3" || txt.includes("não conheço") || txt === "3️⃣") {
            respostaFinal = respostasElite.desculpas();
        } else if (txt.includes("quem") || txt.includes("falando")) {
            respostaFinal = respostasElite.duvida_quem(escolaCliente);
        } else if (txt.includes("quanto") || txt.includes("preço") || txt.includes("valor")) {
            respostaFinal = respostasElite.duvida_preco();
        } else if (txt.includes("agendar") || txt.includes("agendo")) {
            respostaFinal = respostasElite.duvida_agendamento();
        } else if (txt.includes("local") || txt.includes("onde será")) {
            respostaFinal = respostasElite.duvida_local();
        } else if (txt.includes("confiavel") || txt.includes("golpe") || txt.includes("seguro")) {
            respostaFinal = respostasElite.seguranca(escolaCliente);
        } else {
            respostaFinal = respostasElite.duvida_identificacao(nomeCriança);
        }
    }

    await set(ref(db, `respostas/${numeroLimpo}/${Date.now()}`), {
        mensagem: msgType === "audio" ? "[ÁUDIO ENVIADO]" : texto, tipo: "CLIENTE", data: new Date().toLocaleString('pt-BR')
    });

    await enviarMensagemMeta(from, respostaFinal);
}

// ===============================
// 🌐 WEBHOOK & HEARTBEAT
// ===============================
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode && token === VERIFY_TOKEN) { res.status(200).send(challenge); } else { res.sendStatus(403); }
});

app.post('/webhook', async (req, res) => {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const msg = changes?.messages?.[0];
    if (msg && !mensagensProcessadas.has(msg.id)) {
        mensagensProcessadas.add(msg.id);
        await processarMensagemRecebida(msg.from, msg.text?.body || msg.button?.text, msg.type);
    }
    res.sendStatus(200);
});

onValue(ref(db, "config/projeto_ativo"), async (snap) => {
    projId = snap.val();
    if (projId) {
        const snapEscola = await get(ref(db, `projetos/${projId}/escola`));
        escolaGlobal = snapEscola.val() || "Escola";
    }
});

setInterval(async () => {
    if (projId) {
        try {
            await update(ref(db, `projetos/${projId}/bot`), {
                lastPing: Date.now(),
                status: "online"
            });
        } catch (err) { console.error("Erro no Heartbeat"); }
    }
}, 30000);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Elite Bot Rodando na porta ${PORT}`));