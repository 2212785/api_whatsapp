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

const mensagensProcessadas = new Set();

// ===============================
// 📚 CENTRAL DE RESPOSTAS ELITE
// ===============================
// Função que gera o link dinâmico baseado no projeto em que o aluno foi cadastrado
const obterLink = (idProjeto) => {
    const idLimpo = idProjeto || 'guaratingueta-guilherme'; // Backup caso falte o ID
    return `\n\n👇 *CLIQUE NO LINK E AGENDE SUA VISITA (SEM COMPROMISSO):* \nhttps://2212785.github.io/Agendamentos/?id=${idLimpo}`;
};

const avisoTempo = "\n\n⚠️ *AVISO:* Nossa equipe estará na cidade por um *breve período*!";

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
            const escolaFinal = conteudo.escola || "sua escola";
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
// 🚀 ROTA DE DISPARO (CORREÇÃO DE LINK)
// ===============================
app.post('/disparar-template', async (req, res) => {
    const { telefone, nome_formando, escola, projeto_id } = req.body;
    if (!telefone || !nome_formando) return res.status(400).send({ error: "Dados incompletos" });

    try {
        await enviarMensagemMeta(telefone, { criança: nome_formando, escola: escola }, "template");
        
        // CORREÇÃO: Salva o ID do projeto vinculado EXCLUSIVAMENTE ao telefone de destino
        const numeroDestino = telefone.replace(/\D/g, "");
        await set(ref(db, `vinculo_projeto/${numeroDestino}`), {
            projeto_id: projeto_id || "geral",
            nome: nome_formando,
            escola: escola,
            data_disparo: Date.now()
        });

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
    let escolaCliente = "Escola";
    let idProjetoCerto = "";

    try {
        // BUSCA O PROJETO CERTO VINCULADO AO TELEFONE QUE RESPONDEU
        const snapshot = await get(ref(db, `vinculo_projeto/${numeroLimpo}`));
        if (snapshot.exists()) {
            const vinculo = snapshot.val();
            nomeCriança = vinculo.nome || "Formando";
            escolaCliente = vinculo.escola || "Escola";
            idProjetoCerto = vinculo.projeto_id;
        }
    } catch (e) { console.error("Erro ao ler Vínculo de Projeto"); }

    let respostaFinal = "";
    if (msgType === "audio") {
        respostaFinal = respostasElite.audio(idProjetoCerto);
    } else {
        if (txt.includes("não quero") || txt.includes("nao quero") || txt.includes("remover") || txt.includes("pare")) {
            respostaFinal = respostasElite.remover(idProjetoCerto);
        } else if (txt === "1" || txt.includes("sou eu") || txt === "1️⃣") {
            respostaFinal = respostasElite.formando(nomeCriança, idProjetoCerto);
        } else if (txt === "2" || txt.includes("responsavel") || txt === "2️⃣") {
            respostaFinal = respostasElite.responsavel(nomeCriança, idProjetoCerto);
        } else if (txt === "3" || txt.includes("não conheço") || txt === "3️⃣") {
            respostaFinal = respostasElite.desculpas();
        } else if (txt.includes("sobrinha") || txt.includes("sobrinho") || txt.includes("afilhada") || txt.includes("afilhado") || txt.includes("enteada") || txt.includes("enteado") || txt.includes("neto") || txt.includes("neta") || txt.includes("primo") || txt.includes("prima")) {
            respostaFinal = respostasElite.parente_proximo(nomeCriança, idProjetoCerto);
        } else if (txt.includes("digital") || txt.includes("por email") || txt.includes("pelo zap") || txt.includes("mandar foto") || txt.includes("pelo whatsapp") || txt.includes("arquivo")) {
            respostaFinal = respostasElite.duvida_qualidade_digital(idProjetoCerto);
        } else if (txt.includes("outro lugar") || txt.includes("lugar público") || txt.includes("trabalho") || txt.includes("serviço") || txt.includes("padaria") || txt.includes("café")) {
            respostaFinal = respostasElite.duvida_local_reuniao(idProjetoCerto);
        } else if (txt.includes("já comprei") || txt.includes("ja comprei") || txt.includes("já tenho") || txt.includes("ja tenho") || txt.includes("outra empresa")) {
            respostaFinal = respostasElite.ja_tem_fotos(escolaCliente, idProjetoCerto);
        } else if (txt.includes("na hora") || txt.includes("decidir depois") || txt.includes("tempo para pensar") || txt.includes("obrigado a comprar")) {
            respostaFinal = respostasElite.duvida_decisao_hora(idProjetoCerto);
        } else if (txt.includes("entrada") || txt.includes("dar entrada")) {
            respostaFinal = respostasElite.duvida_entrada(idProjetoCerto);
        } else if (txt.includes("limite") || txt.includes("cartão") || txt.includes("cartao")) {
            respostaFinal = respostasElite.duvida_limite_cartao(idProjetoCerto);
        } else if (txt.includes("nome sujo") || txt.includes("spc") || txt.includes("serasa") || txt.includes("restrição") || txt.includes("restricao")) {
            respostaFinal = respostasElite.duvida_nome_sujo(idProjetoCerto);
        } else if (txt.includes("viajando") || txt.includes("fora da cidade") || txt.includes("viajar") || txt.includes("não moro") || txt.includes("nao moro") || txt.includes("mudei") || txt.includes("mora em outra")) {
            respostaFinal = respostasElite.duvida_viajando(idProjetoCerto);
        } else if (txt.includes("trabalho") || txt.includes("sem tempo") || txt.includes("corrido") || txt.includes("horário") || txt.includes("horario")) {
            respostaFinal = respostasElite.duvida_tempo(idProjetoCerto);
        } else if (txt.includes("dinheiro") || txt.includes("condição") || txt.includes("condicao") || txt.includes("desempregado") || txt.includes("pobre")) {
            respostaFinal = respostasElite.duvida_financeiro(idProjetoCerto);
        } else if (txt.includes("avulsa") || txt.includes("comprar uma") || txt.includes("separada")) {
            respostaFinal = respostasElite.duvida_avulsa(idProjetoCerto);
        } else if (txt.includes("se eu não comprar") || txt.includes("fazer com as fotos") || txt.includes("sobrar")) {
            respostaFinal = respostasElite.duvida_nao_comprar(idProjetoCerto);
        } else if (txt.includes("conheço") && (txt.includes("não sou") || txt.includes("nao sou"))) {
            respostaFinal = respostasElite.conhece_mas_nao_responsavel(idProjetoCerto);
        } else if (txt.includes("conseguiu") || txt.includes("número") || txt.includes("numero") || txt.includes("pegou") || txt.includes("deu meu telefone") || txt.includes("deu meu contato")) {
            respostaFinal = respostasElite.duvida_origem_fone(idProjetoCerto);
        } else if (txt.includes("quem") || txt.includes("falando") || txt.includes("empresa")) {
            respostaFinal = respostasElite.duvida_quem(escolaCliente, idProjetoCerto);
        } else if (txt.includes("preço") || txt.includes("valor") || txt.includes("custa")) {
            respostaFinal = respostasElite.duvida_preco(idProjetoCerto);
        } else if (txt.includes("confiavel") || txt.includes("seguro")) {
            respostaFinal = respostasElite.seguranca(escolaCliente, idProjetoCerto);
        } else {
            respostaFinal = respostasElite.fallback(idProjetoCerto);
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Elite Bot Rodando na porta ${PORT}`));
