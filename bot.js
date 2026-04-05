require('dotenv').config();
const express = require('express'); // Adicionado (essencial para o app funcionar)
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
const linkAgendamento = "\n\n👇 *CLIQUE NO LINK E AGENDE SUA VISITA (SEM COMPROMISSO):* \nhttps://2212785.github.io/Agendamentos";
const avisoTempo = "\n\n⚠️ *AVISO:* Nossa equipe estará na cidade por um *breve período*!";

const respostasElite = {
    formando: (criança) => `Maravilha, ${criança}! 😊 Informamos que as fotos de sua formatura ficaram lindas e já estão disponíveis para você conhecer pessoalmente.` + avisoTempo + linkAgendamento,
    
    responsavel: (criança) => `Entendido! 😊 Como você é o responsável pelo(a) ${criança}, informamos que o material fotográfico da formatura já está disponível e ficou maravilhoso.` + avisoTempo + linkAgendamento,
    
    parente_proximo: (criança) => `Entendido! 😊 Informamos que o material fotográfico da formatura da(o) ${criança} já está disponível e ficou maravilhoso. Caso você não seja o responsável direto, pedimos a gentileza de encaminhar esta mensagem a ele(a) para que possamos agendar a visita.` + avisoTempo + linkAgendamento,

    duvida_quem: (escola) => `Olá 😊\n\nSomos da equipe oficial de fotografia da formatura da Escola ${escola}.\n\nEste canal serve para identificar os formandos e agendar as visitas de entrega.` + avisoTempo + linkAgendamento,
    
    duvida_motivo: (escola) => `Estamos entrando em contato para apresentar o material pronto da formatura da Escola ${escola} 📸\n\nAgendamos as visitas para que você veja as fotos pessoalmente e sem compromisso.` + avisoTempo + linkAgendamento,
    
    duvida_preco: () => `Fique tranquilo/a! 😊 Os valores são acessíveis e temos condições de pagamento incríveis que cabem no seu bolso 😊. O representante explicará tudo detalhadamente na visita, que é totalmente sem compromisso!` + avisoTempo + linkAgendamento,
    
    duvida_financeiro: () => `Fique tranquilo(a)! 😊 Nosso objetivo é que você conheça esse trabalho maravilhoso. Temos condições especiais para quem está desempregado ou com restrições. Agende sua visita sem compromisso e converse com nosso representante!` + avisoTempo + linkAgendamento,

    duvida_nome_sujo: () => `Fique tranquila/o, restrição de SPC não é um impedimento para você adquirir esta lembrança maravilhosa. 😊 Pode agendar a visita que nosso representante irá esclarecer todas as suas dúvidas e com certeza, você só não vai adquirir se não gostar das fotos, caso contrário, daremos um jeito.` + avisoTempo + linkAgendamento,

    duvida_limite_cartao: () => `Fique tranquilo! 😊 A falta de limite no cartão ou até mesmo a falta de cartão de crédito ou restrição no nome, não é um impedimento para adquirir essa lembrança maravilhosa. Pode agendar a visita tranquila/o que daremos um jeito!` + avisoTempo + linkAgendamento,

    duvida_entrada: () => `Fique tranquila/o quanto a isso. 😊 As condições de pagamentos são pensadas para te ajudar a conseguir adquirir o material. Caso não tenha um valor para entrada, isso não será um impedimento para a aquisição do material. Pode agendar a visita que será um prazer lhe atender.` + avisoTempo + linkAgendamento,

    duvida_avulsa: () => `Sobre fotos avulsas e outros formatos, o representante apresentará todas as possibilidades e detalhes pessoalmente durante a visita 😊. Você vai amar o material!` + avisoTempo + linkAgendamento,

    duvida_viajando: () => `Sem problemas! 😊 Caso você não esteja na cidade ou não esteja mais morando nela, teria algum parente ou amigo próximo que poderia receber nosso representante para ver esse material por você?` + avisoTempo + linkAgendamento,

    duvida_tempo: () => `Nós temos horários bem flexíveis para te atender! 😊 Atendemos de segunda a sexta das 09:00h às 23:30h, e nos finais de semana das 09:00h às 17:00h. Escolha o melhor momento no link:` + avisoTempo + linkAgendamento,

    duvida_nao_comprar: () => `Se não houver interesse na compra, as fotos são destruídas e os arquivos apagados para garantir a total privacidade da sua família 😊. Mas temos certeza que encontraremos uma forma de você ficar com essa lembrança maravilhosa!` + avisoTempo + linkAgendamento,

    duvida_origem_fone: () => `Os dados foram fornecidos pelos próprios alunos através de uma ficha de cadastro, autorizada pela direção da escola, para facilitar a entrega das fotos de formatura 😊.` + avisoTempo + linkAgendamento,

    conhece_mas_nao_responsavel: () => `Entendi! 😊 Poderia, por gentileza, encaminhar esta mensagem para o responsável? Assim ele consegue agendar um horário para conhecer o material das fotos.` + avisoTempo + linkAgendamento,

    duvida_agendamento: () => `O agendamento é rápido! Basta escolher o melhor horário no link abaixo para receber nosso representante.` + avisoTempo + linkAgendamento,
    
    duvida_local: () => `O representante vai até o seu endereço para apresentar o material com todo conforto e segurança 😊.` + avisoTempo + linkAgendamento,
    
    seguranca: (escola) => `Sim, pode confiar! 😊 Somos a equipe oficial de formatura da Escola ${escola}. A visita serve apenas para você conhecer o material, sem compromisso de compra!` + avisoTempo + linkAgendamento,

    duvida_qualidade_digital: () => `Entendo perfeitamente! 😊 Por questões de segurança e para você apreciar a alta resolução e o acabamento do material físico, o representante leva o álbum completo até você. Ver as fotos em mãos é uma experiência totalmente diferente! Aproveite para tirar suas dúvidas e ver a qualidade pessoalmente.` + avisoTempo + linkAgendamento,

    duvida_local_reuniao: () => `Sem problemas! 😊 Nosso representante pode te encontrar onde for mais confortável e seguro para você: seja na sua residência, no seu local de trabalho ou até em um local público de sua preferência. O importante é você ver esse material!` + avisoTempo + linkAgendamento,

    ja_tem_fotos: (escola) => `Que bom que você valoriza essas memórias! 😊 No entanto, este material que estamos entregando agora é o *oficial e exclusivo* da formatura da Escola ${escola}, com fotos únicas que você ainda não viu. Vale a pena conferir sem compromisso, pois o trabalho ficou realmente especial!` + avisoTempo + linkAgendamento,

    duvida_decisao_hora: () => `Fique super tranquilo(a)! 😊 A visita é justamente para você conhecer o material com calma. O representante vai te apresentar todas as opções e você decide o que for melhor para sua família. Nosso foco é que você veja o resultado desse momento tão importante!` + avisoTempo + linkAgendamento,
    
    audio: () => `Olá! 🤖 Como sou um assistente virtual, eu **não consigo ouvir áudios**. \n\nComo estaremos na cidade por *poucos dias*, por favor, use o link para garantir seu horário:` + linkAgendamento,

    remover: () => `Entendido 👍\n\nPedimos desculpas pelo incômodo. Informamos que vamos excluir seus dados de nosso cadastro imediatamente. Caso mude de ideia e queira conhecer o material, basta realizar o agendamento da visita pelo link abaixo 😊` + avisoTempo + linkAgendamento,

    desculpas: () => `Obrigado pelo retorno 👍\n\nVamos registrar e corrigir nosso contato. Pedimos desculpas pelo inconveniente e agradecemos sua atenção 😊`,

    fallback: () => `Olá! 😊 Como sou um assistente virtual, não consegui entender sua dúvida específica agora.\n\nMas fique tranquilo(a): todos os detalhes e dúvidas técnicas serão esclarecidos pelo representante durante a **visita (totalmente sem compromisso)**.` + avisoTempo + linkAgendamento
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
        if (txt.includes("não quero") || txt.includes("nao quero") || txt.includes("remover") || txt.includes("pare")) {
            respostaFinal = respostasElite.remover();
        } else if (txt === "1" || txt.includes("sou eu") || txt === "1️⃣") {
            respostaFinal = respostasElite.formando(nomeCriança);
        } else if (txt === "2" || txt.includes("responsavel") || txt === "2️⃣") {
            respostaFinal = respostasElite.responsavel(nomeCriança);
        } else if (txt === "3" || txt.includes("não conheço") || txt === "3️⃣") {
            respostaFinal = respostasElite.desculpas();
        } else if (txt.includes("sobrinha") || txt.includes("sobrinho") || txt.includes("afilhada") || txt.includes("afilhado") || txt.includes("enteada") || txt.includes("enteado") || txt.includes("neto") || txt.includes("neta") || txt.includes("primo") || txt.includes("prima")) {
            respostaFinal = respostasElite.parente_proximo(nomeCriança);
        } else if (txt.includes("digital") || txt.includes("por email") || txt.includes("pelo zap") || txt.includes("mandar foto") || txt.includes("pelo whatsapp") || txt.includes("arquivo")) {
            respostaFinal = respostasElite.duvida_qualidade_digital();
        } else if (txt.includes("outro lugar") || txt.includes("lugar público") || txt.includes("trabalho") || txt.includes("serviço") || txt.includes("padaria") || txt.includes("café")) {
            respostaFinal = respostasElite.duvida_local_reuniao();
        } else if (txt.includes("já comprei") || txt.includes("ja comprei") || txt.includes("já tenho") || txt.includes("ja tenho") || txt.includes("outra empresa")) {
            respostaFinal = respostasElite.ja_tem_fotos(escolaCliente);
        } else if (txt.includes("na hora") || txt.includes("decidir depois") || txt.includes("tempo para pensar") || txt.includes("obrigado a comprar")) {
            respostaFinal = respostasElite.duvida_decisao_hora();
        } else if (txt.includes("entrada") || txt.includes("dar entrada")) {
            respostaFinal = respostasElite.duvida_entrada();
        } else if (txt.includes("limite") || txt.includes("cartão") || txt.includes("cartao")) {
            respostaFinal = respostasElite.duvida_limite_cartao();
        } else if (txt.includes("nome sujo") || txt.includes("spc") || txt.includes("serasa") || txt.includes("restrição") || txt.includes("restricao")) {
            respostaFinal = respostasElite.duvida_nome_sujo();
        } else if (txt.includes("viajando") || txt.includes("fora da cidade") || txt.includes("viajar") || txt.includes("não moro") || txt.includes("nao moro") || txt.includes("mudei") || txt.includes("mora em outra")) {
            respostaFinal = respostasElite.duvida_viajando();
        } else if (txt.includes("trabalho") || txt.includes("sem tempo") || txt.includes("corrido") || txt.includes("horário") || txt.includes("horario")) {
            respostaFinal = respostasElite.duvida_tempo();
        } else if (txt.includes("dinheiro") || txt.includes("condição") || txt.includes("condicao") || txt.includes("desempregado") || txt.includes("pobre")) {
            respostaFinal = respostasElite.duvida_financeiro();
        } else if (txt.includes("avulsa") || txt.includes("comprar uma") || txt.includes("separada")) {
            respostaFinal = respostasElite.duvida_avulsa();
        } else if (txt.includes("se eu não comprar") || txt.includes("fazer com as fotos") || txt.includes("sobrar")) {
            respostaFinal = respostasElite.duvida_nao_comprar();
        } else if (txt.includes("conheço") && (txt.includes("não sou") || txt.includes("nao sou"))) {
            respostaFinal = respostasElite.conhece_mas_nao_responsavel();
        } else if (txt.includes("conseguiu") || txt.includes("número") || txt.includes("numero") || txt.includes("pegou") || txt.includes("deu meu telefone") || txt.includes("deu meu contato")) {
            respostaFinal = respostasElite.duvida_origem_fone();
        } else if (txt.includes("quem") || txt.includes("falando") || txt.includes("empresa")) {
            respostaFinal = respostasElite.duvida_quem(escolaCliente);
        } else if (txt.includes("preço") || txt.includes("valor") || txt.includes("custa")) {
            respostaFinal = respostasElite.duvida_preco();
        } else if (txt.includes("confiavel") || txt.includes("seguro")) {
            respostaFinal = respostasElite.seguranca(escolaCliente);
        } else {
            respostaFinal = respostasElite.fallback();
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
    
    if (!msg || !msg.from) {
        return res.sendStatus(200);
    }

    if (!mensagensProcessadas.has(msg.id)) {
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
