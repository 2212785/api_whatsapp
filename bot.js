require('dotenv').config();  
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get, set } = require("firebase/database");

// ===============================
// 🔧 CONFIG
// ===============================
const app = express();
app.use(express.json());
app.use(cors());

const META_TOKEN = process.env.META_TOKEN; 
const PHONE_ID = '1090608227463192'; 
const VERIFY_TOKEN = 'meu_token_elite'; 

if (!META_TOKEN) {
    console.error("❌ META_TOKEN não definido!");
}

const firebaseConfig = {
    apiKey: "AIzaSyANz1gbAi3PIGwS1-RzOIXF6SUZvS2U0mU",
    databaseURL: "https://agenda-album-de-formatura-default-rtdb.firebaseio.com"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

const mensagensProcessadas = new Set();

// ===============================
// 🔥 FUNÇÃO PADRÃO (CRÍTICA)
// ===============================
function normalizarNumero(numero) {
    let n = numero.replace(/\D/g, "");
    if (!n.startsWith("55")) {
        n = "55" + n;
    }
    return n;
}

// ===============================
// 🔗 LINK (SEM GLOBAL)
// ===============================
const obterLink = (idProjeto) => {
    return `\n\n👇 *CLIQUE NO LINK E AGENDE SUA VISITA (SEM COMPROMISSO):* \nhttps://2212785.github.io/Agendamentos/?id=${idProjeto}`;
};

const avisoTempo = "\n\n⚠️ *AVISO:* Nossa equipe estará na cidade por um *breve período*!";

// ===============================
// 💬 RESPOSTAS
// ===============================
const respostasElite = {
    formando: (criança, id) => `Maravilha, ${criança}! 😊 Informamos que as fotos de sua formatura ficaram lindas e já estão disponíveis para você conhecer pessoalmente.` + avisoTempo + obterLink(id),
    
    responsavel: (criança, id) => `Entendido! 😊 Como você é o responsável pelo(a) ${criança}, informamos que o material fotográfico da formatura já está disponível e ficou maravilhoso.` + avisoTempo + obterLink(id),
    
    parente_proximo: (criança, id) => `Entendido! 😊 Informamos que o material fotográfico da formatura da(o) ${criança} já está disponível e ficou maravilhoso. Caso você não seja o responsável direto, pedimos a gentileza de encaminhar esta mensagem a ele(a) para que possamos agendar a visita.` + avisoTempo + obterLink(id),

    duvida_quem: (escola, id) => `Olá 😊\n\nSomos da equipe oficial de fotografia da formatura da Escola ${escola}.\n\nEste canal serve para identificar os formandos e agendar as visitas de entrega.` + avisoTempo + obterLink(id),
    
    duvida_motivo: (escola, id) => `Estamos entrando em contato para apresentar o material pronto da formatura da Escola ${escola} 📸\n\nAgendamos as visitas para que você veja as fotos pessoalmente e sem compromisso.` + avisoTempo + obterLink(id),
    
    duvida_preco: (id) => `Fique tranquilo/a! 😊 Os valores são acessíveis e temos condições de pagamento incríveis que cabem no seu bolso 😊. O representante explicará tudo detalhadamente na visita, que é totalmente sem compromisso!` + avisoTempo + obterLink(id),
    
    duvida_financeiro: (id) => `Fique tranquilo(a)! 😊 Nosso objetivo é que você conheça esse trabalho maravilhoso. Temos condições especiais para quem está desempregado ou com restrições. Agende sua visita sem compromisso e converse com nosso representante!` + avisoTempo + obterLink(id),

    duvida_nome_sujo: (id) => `Fique tranquila/o, restrição de SPC não é um impedimento para você adquirir esta lembrança maravilhosa. 😊 Pode agendar a visita que nosso representante irá esclarecer todas as suas dúvidas e com certeza, você só não vai adquirir se não gostar das fotos, caso contrário, daremos um jeito.` + avisoTempo + obterLink(id),

    duvida_limite_cartao: (id) => `Fique tranquilo! 😊 A falta de limite no cartão ou até mesmo a falta de cartão de crédito ou restrição no nome, não é um impedimento para adquirir essa lembrança maravilhosa. Pode agendar a visita tranquila/o que daremos um jeito!` + avisoTempo + obterLink(id),

    duvida_entrada: (id) => `Fique tranquila/o quanto a isso. 😊 As condições de pagamentos são pensadas para te ajudar a conseguir adquirir o material. Caso não tenha um valor para entrada, isso não será um impedimento para a aquisição do material. Pode agendar a visita que será um prazer lhe atender.` + avisoTempo + obterLink(id),

    duvida_avulsa: (id) => `Sobre fotos avulsas e outros formatos, o representante apresentará todas as possibilidades e detalhes pessoalmente durante a visita 😊. Você vai amar o material!` + avisoTempo + obterLink(id),

    duvida_viajando: (id) => `Sem problemas! 😊 Caso você não esteja na cidade ou não esteja mais morando nela, teria algum parente ou amigo próximo que poderia receber nosso representante para ver esse material por você?` + avisoTempo + obterLink(id),

    duvida_tempo: (id) => `Nós temos horários bem flexíveis para te atender! 😊 Atendemos de segunda a sexta das 09:00h às 23:30h, e nos finais de semana das 09:00h às 17:00h. Escolha o melhor momento no link:` + avisoTempo + obterLink(id),

    duvida_nao_comprar: (id) => `Se não houver interesse na compra, as fotos são destruídas e os arquivos apagados para garantir a total privacidade da sua família 😊. Mas temos certeza que encontraremos uma forma de você ficar com essa lembrança maravilhosa!` + avisoTempo + obterLink(id),

    duvida_origem_fone: (id) => `Os dados foram fornecidos pelos próprios alunos através de uma ficha de cadastro, autorizada pela direção da escola, para facilitar a entrega das fotos de formatura 😊.` + avisoTempo + obterLink(id),

    conhece_mas_nao_responsavel: (id) => `Entendi! 😊 Poderia, por gentileza, encaminhar esta mensagem para o responsável? Assim ele consegue agendar um horário para conhecer o material das fotos.` + avisoTempo + obterLink(id),

    duvida_agendamento: (id) => `O agendamento é rápido! Basta escolher o melhor horário no link abaixo para receber nosso representante.` + avisoTempo + obterLink(id),
    
    duvida_local: (id) => `O representante vai até o seu endereço para apresentar o material com todo conforto e segurança 😊.` + avisoTempo + obterLink(id),
    
    seguranca: (escola, id) => `Sim, pode confiar! 😊 Somos a equipe oficial de formatura da Escola ${escola}. A visita serve apenas para você conhecer o material, sem compromisso de compra!` + avisoTempo + obterLink(id),

    duvida_qualidade_digital: (id) => `Entendo perfeitamente! 😊 Por questões de segurança e para você apreciar a alta resolução e o acabamento do material físico, o representante leva o álbum completo até você. Ver as fotos em mãos é uma experiência totalmente diferente! Aproveite para tirar suas dúvidas e ver a qualidade pessoalmente.` + avisoTempo + obterLink(id),

    duvida_local_reuniao: (id) => `Sem problemas! 😊 Nosso representante pode te encontrar onde for mais confortável e seguro para você: seja na sua residência, no seu local de trabalho ou até em um local público de sua preferência. O importante é você ver esse material!` + avisoTempo + obterLink(id),

    ja_tem_fotos: (escola, id) => `Que bom que você valoriza essas memórias! 😊 No entanto, este material que estamos entregando agora é o *oficial e exclusivo* da formatura da Escola ${escola}, com fotos únicas que você ainda não viu. Vale a pena conferir sem compromisso, pois o trabalho ficou realmente especial!` + avisoTempo + obterLink(id),

    duvida_decisao_hora: (id) => `Fique super tranquilo(a)! 😊 A visita é justamente para você conhecer o material com calma. O representante vai te apresentar todas as opções e você decide o que for melhor para sua família. Nosso foco é que você veja o resultado desse momento tão importante!` + avisoTempo + obterLink(id),
    
    audio: (id) => `Olá! 🤖 Como sou um assistente virtual, eu **não consigo ouvir áudios**. \n\nComo estaremos na cidade por *poucos dias*, por favor, use o link para garantir seu horário:` + obterLink(id),

    remover: (id) => `Entendido 👍\n\nPedimos desculpas pelo incômodo. Informamos que vamos excluir seus dados de nosso cadastro imediatamente. Caso mude de ideia e queira conhecer o material, basta realizar o agendamento da visita pelo link abaixo 😊` + avisoTempo + obterLink(id),

    desculpas: () => `Obrigado pelo retorno 👍\n\nVamos registrar e corrigir nosso contato. Pedimos desculpas pelo inconveniente e agradecemos sua atenção 😊`,

    fallback: (id) => `Olá! 😊 Como sou um assistente virtual, não consegui entender sua dúvida específica agora.\n\nMas fique tranquilo(a): todos os detalhes e dúvidas técnicas serão esclarecidos pelo representante durante a **visita (totalmente sem compromisso)**.` + avisoTempo + obterLink(id)
};

// ===============================
// 📤 ENVIO WHATSAPP
// ===============================
async function enviarMensagemMeta(to, conteudo, tipo = "text") {
    try {
        let data;

        if (tipo === "text") {
            data = {
                messaging_product: "whatsapp",
                to,
                type: "text",
                text: { body: conteudo }
            };
        } else {
            const nome = conteudo.criança || "Cliente";
            const escola = conteudo.escola || "sua escola";

            data = {
                messaging_product: "whatsapp",
                to,
                type: "template",
                template: {
                    name: "inicio_contato",
                    language: { code: "pt_BR" },
                    components: [{
                        type: "body",
                        parameters: [
                            { type: "text", text: nome },
                            { type: "text", text: escola }
                        ]
                    }]
                }
            };
        }

        await axios.post(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, data, {
            headers: {
                Authorization: `Bearer ${META_TOKEN}`,
                "Content-Type": "application/json"
            }
        });

    } catch (err) {
        console.error("❌ ERRO WHATS:", err.response?.data || err.message);
    }
}

// ===============================
// 🚀 DISPARO
// ===============================
app.post('/disparar-template', async (req, res) => {
    const { telefone, nome_formando, escola, projeto_id } = req.body;

    if (!telefone || !nome_formando || !projeto_id) {
        return res.status(400).send({ error: "Dados incompletos" });
    }

    try {
        const numero = normalizarNumero(telefone);

        await enviarMensagemMeta(numero, {
            criança: nome_formando,
            escola
        }, "template");

        await set(ref(db, `vinculo_projeto/${numero}`), {
            projeto_id,
            nome: nome_formando,
            escola,
            data: Date.now()
        });

        console.log("✅ Vínculo salvo:", numero, projeto_id);

        res.send({ ok: true });

    } catch (e) {
        res.status(500).send({ error: "Erro disparo" });
    }
});

// ===============================
// 🤖 PROCESSAR MENSAGEM
// ===============================
async function processarMensagemRecebida(from, texto, tipo = "text") {
    const numero = normalizarNumero(from);
    const txt = (texto || "").toLowerCase().trim();

    console.log("📲 Recebido:", numero);

    const snap = await get(ref(db, `vinculo_projeto/${numero}`));

    if (!snap.exists()) {
        console.log("❌ SEM VÍNCULO");
        return;
    }

    const vinculo = snap.val();
    const projeto_id = vinculo.projeto_id;

    if (!projeto_id || projeto_id === "geral") {
        console.log("❌ PROJETO INVÁLIDO:", vinculo);
        return;
    }

    console.log("✅ Projeto correto:", projeto_id);

    let resposta;

    if (tipo === "audio") {
        resposta = respostasElite.audio(projeto_id);
    } else if (txt.includes("1")) {
        resposta = respostasElite.formando(vinculo.nome, projeto_id);
    } else if (txt.includes("2")) {
        resposta = respostasElite.responsavel(vinculo.nome, projeto_id);
    } else if (txt.includes("3")) {
        resposta = respostasElite.desculpas();
    } else {
        resposta = respostasElite.fallback(projeto_id);
    }

    await enviarMensagemMeta(numero, resposta);
}

// ===============================
// 🌐 WEBHOOK
// ===============================
app.get('/webhook', (req, res) => {
    if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
        return res.send(req.query['hub.challenge']);
    }
    res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!msg || !msg.from) return res.sendStatus(200);

    if (!mensagensProcessadas.has(msg.id)) {
        mensagensProcessadas.add(msg.id);
        await processarMensagemRecebida(
            msg.from,
            msg.text?.body,
            msg.type
        );
    }

    res.sendStatus(200);
});

// ===============================
app.listen(process.env.PORT || 10000, () => {
    console.log("🚀 BOT RODANDO");
});
