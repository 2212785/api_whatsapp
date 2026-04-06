require('dotenv').config();  
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get, set, onValue } = require("firebase/database");

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

// Variável para armazenar o ID do projeto que está ativo no sistema globalmente
let projetoAtivoGlobal = "";

// Sincroniza em tempo real qual projeto você ativou no painel
onValue(ref(db, "config/projeto_ativo"), (snap) => {
    if (snap.exists()) {
        projetoAtivoGlobal = snap.val();
        console.log(`📌 Projeto Ativo no Sistema: ${projetoAtivoGlobal}`);
    }
});

// ===============================
// 🔥 NORMALIZAR TELEFONE
// ===============================
function normalizarNumero(numero) {
    let n = numero.replace(/\D/g, "");
    if (!n.startsWith("55")) {
        n = "55" + n;
    }
    return n;
}

// ===============================
// 🔗 LINK (100% SEGURO)
// ===============================
const obterLink = (idProjeto) => {
    // CORREÇÃO: Garante que nunca retorne link vazio ou 'geral'. 
    // Se o ID for inválido, usa o projeto ativo global como backup dinâmico.
    const idFinal = (idProjeto && idProjeto !== "geral" && idProjeto !== "") ? idProjeto : projetoAtivoGlobal;

    if (!idFinal) {
        console.log("❌ ERRO LINK: Nenhum projeto ativo encontrado.");
        return "\n\n⚠️ Erro ao gerar link. Fale com o suporte.";
    }

    return `\n\n👇 *CLIQUE NO LINK E AGENDE SUA VISITA (SEM COMPROMISSO):*\nhttps://2212785.github.io/Agendamentos/?id=${idFinal}`;
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
    
    duvida_preco: (id) => `🤖 Como sou um assistente virtual, eu **não consigo informar valores, mas fique tranquilo(a)! 😊 Os valores são acessíveis e temos condições de pagamento incríveis que cabem no seu bolso 😊. O representante explicará tudo detalhadamente na visita, que é totalmente sem compromisso!` + avisoTempo + obterLink(id),
    
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

    remover: (id) => `Entendemos. Estaremos excluindo seu contato do nosso cadastro. As fotos serão destruídas e descartadas e os arquivos apagados para garantir a total privacidade da sua família 😊. Se mudar de idéia nos próximos dias estaremos á disposição!` + avisoTempo + obterLink(id),

    desculpas: () => `Obrigado pelo retorno 👍\n\nVamos registrar e corrigir nosso contato. Pedimos desculpas pelo inconveniente e agradecemos sua atenção 😊`,

    fallback: (id) => `Olá! 😊 Como sou um assistente virtual, não consegui entender sua dúvida específica agora.\n\nMas fique tranquilo(a): todos os detalhes e dúvidas técnicas serão esclarecidos pelo representante durante a **visita (totalmente sem compromisso)**.` + avisoTempo + obterLink(id)
};

// ===============================
// 📤 ENVIO WHATSAPP
// ===============================
async function enviarMensagemMeta(to, conteudo, tipo = "text", usuario = "Evanio") {
    try {
        let data;
        let textoParaLog = "";

        if (tipo === "text") {
            data = {
                messaging_product: "whatsapp",
                to,
                type: "text",
                text: { body: conteudo }
            };
            textoParaLog = conteudo;
        } else {
            const nome = conteudo.criança || "Cliente";
            const escola = conteudo.escola || "sua escola";
            textoParaLog = `[TEMPLATE: inicio_contato] Olá ${nome}, fotos prontas.`;

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

        await axios.post(
            `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`,
            data,
            {
                headers: {
                    Authorization: `Bearer ${META_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("📤 Mensagem enviada para:", to);

        const numeroLimpo = to.replace(/\D/g, "");
        await set(ref(db, `respostas/${usuario}/${numeroLimpo}/${Date.now()}`), {
            mensagem: textoParaLog,
            tipo: "BOT",
            data: new Date().toLocaleString('pt-BR')
        });

    } catch (err) {
        console.error("❌ ERRO WHATS:", err.response?.data || err.message);
    }
}

// ===============================
// 🚀 DISPARO
// ===============================
app.post('/disparar-template', async (req, res) => {
    const { telefone, nome_formando, escola, projeto_id, usuario } = req.body;

    console.log("📤 DISPARO:", req.body);

    if (!telefone || !nome_formando || !projeto_id) {
        return res.status(400).send({ error: "Dados incompletos" });
    }

    try {
        const numero = normalizarNumero(telefone);

        await enviarMensagemMeta(numero, {
            criança: nome_formando,
            escola
        }, "template", usuario || "Evanio");

        await set(ref(db, `vinculo_projeto/${numero}`), {
            projeto_id,
            nome: nome_formando,
            escola,
            usuario: usuario || "Evanio", 
            data: Date.now()
        });

        console.log("✅ Vínculo salvo:", numero, projeto_id);

        res.send({ ok: true });

    } catch (e) {
        console.error("❌ ERRO DISPARO:", e);
        res.status(500).send({ error: "Erro disparo" });
    }
});

// ===============================
// 🤖 PROCESSAR MENSAGEM
// ===============================
async function processarMensagemRecebida(from, texto, tipo = "text") {
    const numero = normalizarNumero(from);
    const txt = (texto || "").toLowerCase().trim();

    console.log("📲 Recebido:", numero, "| Texto:", txt);

    try {
        const snap = await get(ref(db, `vinculo_projeto/${numero}`));

        if (!snap.exists()) {
            console.log("❌ SEM VÍNCULO → respondendo fallback");
            await enviarMensagemMeta(numero, "Olá! Não localizei seu cadastro.", "text", "Evanio");
            return;
        }

        const vinculo = snap.val();
        const projeto_id = vinculo.projeto_id;
        const usuarioDono = vinculo.usuario || "Evanio"; 
        const escolaCliente = vinculo.escola || "sua escola";
        const nomeFormando = vinculo.nome || "Formando";

        console.log("✅ Projeto vinculado:", projeto_id, "| Usuário:", usuarioDono);

        let respostaFinal = "";

        // ===============================
        // 🧠 LÓGICA DE INTELIGÊNCIA (PALAVRAS-CHAVE)
        // ===============================
        if (tipo === "audio") {
            respostaFinal = respostasElite.audio(projeto_id);
        } else if (txt.includes("não quero") || txt.includes("nao quero") || txt.includes("remover") || txt.includes("pare") || txt.includes("não tenho interesse") || txt.includes("nao tenho interesse")) {
            respostaFinal = respostasElite.remover(projeto_id);
        } else if (txt === "1" || txt.includes("sou eu") || txt === "1️⃣") {
            respostaFinal = respostasElite.formando(nomeFormando, projeto_id);
        // } else if (txt === "2" || txt.includes("responsavel") || txt.includes("sou o responsável") || txt === "2️⃣") {
        } else if (txt === "2" || txt.includes("responsavel") || txt.includes("responsável") || txt.includes("sou o pai") || txt.includes("sou a mãe") || txt.includes("sou a mae") || txt.includes("meu filho") || txt.includes("minha filha") || txt.includes("meu enteado") || txt.includes("minha enteada") || txt === "2️⃣") {
            respostaFinal = respostasElite.responsavel(nomeFormando, projeto_id);
        } else if (txt === "3" || txt.includes("não conheço") || txt === "3️⃣") {
            respostaFinal = respostasElite.desculpas();
        } else if (txt.includes("sobrinha") || txt.includes("sobrinho") || txt.includes("afilhada") || txt.includes("afilhado") || txt.includes("neto") || txt.includes("neta")) {
            respostaFinal = respostasElite.parente_proximo(nomeFormando, projeto_id);
        } else if (txt.includes("digital") || txt.includes("por email") || txt.includes("arquivo")) {
            respostaFinal = respostasElite.duvida_qualidade_digital(projeto_id);
        } else if (txt.includes("já comprei") || txt.includes("ja comprei") || txt.includes("já tenho")) {
            respostaFinal = respostasElite.ja_tem_fotos(escolaCliente, projeto_id);
        } else if (txt.includes("na hora") || txt.includes("decidir depois")) {
            respostaFinal = respostasElite.duvida_decisao_hora(projeto_id);
        } else if (txt.includes("entrada") || txt.includes("dar entrada")) {
            respostaFinal = respostasElite.duvida_entrada(projeto_id);
        } else if (txt.includes("limite") || txt.includes("cartão")) {
            respostaFinal = respostasElite.duvida_limite_cartao(projeto_id);
        } else if (txt.includes("nome sujo") || txt.includes("spc") || txt.includes("serasa")) {
            respostaFinal = respostasElite.duvida_nome_sujo(projeto_id);
        } else if (txt.includes("viajando") || txt.includes("fora da cidade")) {
            respostaFinal = respostasElite.duvida_viajando(projeto_id);
        } else if (txt.includes("trabalho") || txt.includes("sem tempo") || txt.includes("corrido") || txt.includes("horário")) {
            respostaFinal = respostasElite.duvida_tempo(projeto_id);
        } else if (txt.includes("dinheiro") || txt.includes("condição") || txt.includes("desempregado")) {
            respostaFinal = respostasElite.duvida_financeiro(projeto_id);
        } else if (txt.includes("avulsa") || txt.includes("comprar uma")) {
            respostaFinal = respostasElite.duvida_avulsa(projeto_id);
        } else if (txt.includes("se eu não comprar") || txt.includes("sobrar")) {
            respostaFinal = respostasElite.duvida_nao_comprar(projeto_id);
        } else if (txt.includes("quem") || txt.includes("falando") || txt.includes("empresa")) {
            respostaFinal = respostasElite.duvida_quem(escolaCliente, projeto_id);
        // } else if (txt.includes("preço") || txt.includes("valor") || txt.includes("custa") || txt.includes("quanto fica")) {
        } else if (txt.includes("preço") || txt.includes("preco") || txt.includes("valor") || txt.includes("custa") || txt.includes("custo") || txt.includes("quanto fica") || txt.includes("qual o valor") || txt.includes("qual o preço")) {
            respostaFinal = respostasElite.duvida_preco(projeto_id);
        } else if (txt.includes("confiavel") || txt.includes("seguro")) {
            respostaFinal = respostasElite.seguranca(escolaCliente, projeto_id);
        } else {
            respostaFinal = respostasElite.fallback(projeto_id);
        }

        // SALVA MENSAGEM DO CLIENTE
        await set(ref(db, `respostas/${usuarioDono}/${numero}/${Date.now()}`), {
            mensagem: tipo === "audio" ? "[ÁUDIO ENVIADO]" : texto,
            tipo: "CLIENTE",
            data: new Date().toLocaleString('pt-BR')
        });

        // BOT RESPONDE
        await enviarMensagemMeta(numero, respostaFinal, "text", usuarioDono);

    } catch (e) {
        console.error("❌ ERRO PROCESSAMENTO:", e);
    }
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
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const msg = changes?.messages?.[0];

    if (!msg || !msg.from) return res.sendStatus(200);

    if (!mensagensProcessadas.has(msg.id)) {
        mensagensProcessadas.add(msg.id);

        await processarMensagemRecebida(
            msg.from,
            msg.text?.body || msg.button?.text,
            msg.type
        );
    }

    res.sendStatus(200);
});

// ===============================
app.listen(process.env.PORT || 10000, () => {
    console.log("🚀 BOT RODANDO");
});
