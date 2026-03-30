require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get, onValue } = require("firebase/database");

// ===============================
// 🛡️ VERIFICAÇÃO DE AMBIENTE
// ===============================
console.log("--------------------------------------------------");
console.log("🔑 STATUS DO TOKEN:", process.env.META_TOKEN ? "✅ OK (DEFINIDO)" : "❌ NÃO DEFINIDO");
console.log("--------------------------------------------------");

const app = express();
app.use(express.json());

// ===============================
// 🔑 CONFIGURAÇÕES DA META
// ===============================
const META_TOKEN = process.env.META_TOKEN; 

if (!META_TOKEN) {
    console.error("❌ ERRO CRÍTICO: META_TOKEN não definido no terminal!");
    console.error("Verifique se o seu arquivo .env foi criado corretamente.");
    process.exit(1); 
}

// ⚠️ VERIFIQUE SE ESTE ID CONTINUA O MESMO NO PAINEL APÓS IR PARA PRODUÇÃO
const PHONE_ID = '1090608227463192'; 
const VERIFY_TOKEN = 'meu_token_elite'; 

// 🔥 CONFIG FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyANz1gbAi3PIGwS1-RzOIXF6SUZvS2U0mU",
    databaseURL: "https://agenda-album-de-formatura-default-rtdb.firebaseio.com"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

let projId = "";
let escola = "";

const enviados = new Set();
const mensagensProcessadas = new Set();

// ===============================
// 📚 RESPOSTAS DO CHATBOT
// ===============================
const respostas = {
    formando: ["Maravilha! 😊 Como você é o formando, as recordações já estão separadas. Ficaremos na cidade por poucos dias, com atendimento até as 20:30h.\n\n👉 https://2212785.github.io/Agendamentos"],
    responsavel: ["Entendido! 😊 Como você é o responsável, informamos que as fotos já estão prontas.\n\n👉 https://2212785.github.io/Agendamentos"],
    desculpas: ["Pedimos desculpas pelo incômodo! 🙏 Vamos remover seu número do cadastro."],
    preco: ["Entendo sua dúvida! 😊\n\nNão estamos autorizados a informar valores sem que você veja o material pessoalmente.\n\nMas fique tranquilo(a): os valores são acessíveis e com ótimas condições, podendo parcelar em até 12x."]
};

const sortear = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ===============================
// 📤 FUNÇÃO DE ENVIO PROFISSIONAL
// ===============================
async function enviarMensagemMeta(to, conteudo, tipo = "text") {
    try {
        let data;
        let textoParaFirebase = "";

        if (tipo === "text") {
            data = {
                messaging_product: "whatsapp",
                to: to,
                type: "text",
                text: { body: conteudo }
            };
            textoParaFirebase = conteudo;
        } 
        else if (tipo === "template") {
            const nomeFinal = conteudo.nome || "Cliente";
            const escolaFinal = conteudo.escola || escola || "sua escola";
            textoParaFirebase = `[TEMPLATE: inicio_contato] Olá ${nomeFinal}, fotos da escola ${escolaFinal} prontas.`;

            data = {
                messaging_product: "whatsapp",
                to: to,
                type: "template",
                template: {
                    name: "inicio_contato",
                    language: { code: "pt_BR" },
                    components: [
                        {
                            type: "body", 
                            parameters: [
                                { type: "text", text: String(nomeFinal) },
                                { type: "text", text: String(escolaFinal) }
                            ]
                        }
                    ]
                }
            };
        }

        const response = await axios.post(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, data, {
            headers: { 
                'Authorization': `Bearer ${META_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`✅ SUCESSO META: Mensagem enviada para ${to}`);

        // 💾 SALVAR A FALA DO BOT NO FIREBASE PARA O PAINEL
        const numeroLimpo = to.replace(/\D/g, "");
        try {
            await axios.post(`https://agenda-album-de-formatura-default-rtdb.firebaseio.com/respostas/${numeroLimpo}.json`, {
                mensagem: textoParaFirebase,
                tipo: "BOT",
                data: new Date().toLocaleString('pt-BR')
            });
        } catch (fbErr) {
            console.error("❌ Erro ao registrar fala do BOT no Firebase");
        }

    } catch (err) {
        console.error(`❌ ERRO AO ENVIAR PARA ${to}:`);
        if (err.response) {
            console.error(JSON.stringify(err.response.data, null, 2));
        } else {
            console.error(err.message);
        }
    }
}

// ===============================================
// 🚀 ROTA DE COMANDO PARA DISPARO (NOVA)
// ===============================================
app.post('/disparar-template', async (req, res) => {
    const { telefone, nome_formando, escola: escolaMsg } = req.body;

    if (!telefone || !nome_formando) {
        return res.status(400).send({ error: "Telefone e Nome são obrigatórios" });
    }

    try {
        console.log(`📡 Comando Cloud recebido para: ${nome_formando} (${telefone})`);
        
        // Aciona a função que já existe no seu código
        await enviarMensagemMeta(telefone, { 
            nome: nome_formando, 
            escola: escolaMsg || escola 
        }, "template");

        res.status(200).send({ success: true });
    } catch (error) {
        res.status(500).send({ error: "Erro no processamento do disparo" });
    }
});

// ===============================
// 🤖 PROCESSAR RESPOSTAS
// ===============================
async function processarMensagemRecebida(from, texto) {
    const txt = texto.toLowerCase().trim();
    const numeroLimpo = from.replace(/\D/g, "");

    let tipoCliente = "indefinido";
    if (txt === "1" || txt.includes("sou eu") || txt === "1️⃣") tipoCliente = "formando";
    if (txt === "2" || txt.includes("filho") || txt === "2️⃣" || txt.includes("filha")) tipoCliente = "responsavel";
    if (txt === "3" || txt.includes("não conheço") || txt === "3️⃣" || txt.includes("não conheco")) tipoCliente = "erro";
    if (txt.includes("preço") || txt.includes("valor") || txt.includes("quanto") || txt.includes("custa")) tipoCliente = "interesse_preco";

    try {
        await axios.post(`https://agenda-album-de-formatura-default-rtdb.firebaseio.com/respostas/${numeroLimpo}.json`, {
            mensagem: texto,
            tipo: tipoCliente,
            data: new Date().toLocaleString('pt-BR')
        });
    } catch (error) {
        console.error("❌ Erro ao salvar histórico no Firebase:", error.message);
    }

    if (tipoCliente === "interesse_preco") return enviarMensagemMeta(from, sortear(respostas.preco));
    if (tipoCliente === "formando") return enviarMensagemMeta(from, sortear(respostas.formando));
    if (tipoCliente === "responsavel") return enviarMensagemMeta(from, sortear(respostas.responsavel));
    if (tipoCliente === "erro") return enviarMensagemMeta(from, sortear(respostas.desculpas));

    return enviarMensagemMeta(from, "Olá! 😊 Poderia responder com uma das opções abaixo?\n\n1️⃣ Sim, sou eu.\n2️⃣ Sim, é meu filho/a.\n3️⃣ Não conheço.");
}

// ===============================
// 🌐 WEBHOOK
// ===============================
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode && token === VERIFY_TOKEN) {
        console.log("✅ Webhook Verificado!");
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

app.post('/webhook', async (req, res) => {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0]?.value;

    if (changes?.statuses) {
        const status = changes.statuses[0];
        if (status.status === 'failed') {
            console.error("--------------------------------------------------");
            console.error(`❌ ERRO DE ENTREGA DETECTADO:`);
            if (status.errors) console.error(JSON.stringify(status.errors, null, 2));
            console.error("--------------------------------------------------");
        } else {
            console.log(`📊 Status da msg: ${status.status} para ${status.recipient_id}`);
        }
    }

    const msg = changes?.messages?.[0];
    if (msg && !mensagensProcessadas.has(msg.id)) {
        mensagensProcessadas.add(msg.id);
        const texto = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title;
        if (texto) {
            console.log(`📩 Resposta de ${msg.from}: ${texto}`);
            await processarMensagemRecebida(msg.from, texto);
        }
    }
    res.sendStatus(200);
});

// ===============================
// 🔄 FIREBASE E MONITORAMENTO
// ===============================
function monitorarProjeto() {
    onValue(ref(db, "config/projeto_ativo"), async (snap) => {
        projId = snap.val();
        if (projId) {
            const snapEscola = await get(ref(db, `projetos/${projId}/escola`));
            escola = snapEscola.val() || "sua escola";
            console.log(`🔄 Monitorando Projeto: ${projId} | Escola: ${escola}`);
        }
    });
}

// ===============================
// 🚀 DISPARO EM MASSA
// ===============================
async function dispararLista(listaTexto) {
    const linhas = listaTexto.trim().split('\n');
    for (let linha of linhas) {
        if (!linha.trim() || !linha.includes(',')) continue;
        const partes = linha.split(',');
        const nomeAlvo = partes[0].trim();
        const foneRaw = partes[1].trim().replace(/\D/g, "");
        let fone = `55${foneRaw.replace(/^55/, '')}`;

        if (!/^55\d{10,11}$/.test(fone)) continue;
        if (fone.includes("12992157107")) continue;

        try {
            await axios.post(`https://agenda-album-de-formatura-default-rtdb.firebaseio.com/enviados.json`, {
                nome: nomeAlvo, telefone: fone, escola, data: new Date().toLocaleString('pt-BR')
            });
        } catch (error) {}

        console.log(`📤 Disparando convite produção para: ${nomeAlvo} (${fone})...`);
        await enviarMensagemMeta(fone, { nome: nomeAlvo, escola: escola }, "template");
        
        const delay = 8000 + Math.random() * 5000;
        await new Promise(r => setTimeout(r, delay)); 
    }
}

// ===============================
// 🏁 INICIAR SERVIDOR
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 Servidor Elite Sales Bot Ativo na porta ${PORT}`);
    monitorarProjeto();

    setTimeout(async () => {
        const listaParaTeste = `

        `;
        console.log("🧪 Iniciando rodada de testes em produção...");
        await dispararLista(listaParaTeste);
    }, 5000); 
});