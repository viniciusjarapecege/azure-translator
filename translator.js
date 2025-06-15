import fs from 'fs';
import readline from 'readline';
import axios from 'axios';
import dotenv from 'dotenv';
import classLanguage from './pt.json' with { type: 'json' };
import appLanguage from './pt.js';

dotenv.config();

const MOVE_TYPE = {
    "APP": 1,
    "CLASS": 2,
};

const LANGUAGES = ['en', 'es', 'fr', 'ar', 'lzh', 'ru'];

let sourceOption, calendarOption;

// Função para formatar o arquivo JS em JSON ignorando o calendar_locale
function formatAppLanguage(obj) {
    const { calendar_locale, ...rest } = obj;
    return rest;
}

function daysForLocale(localeName) {
    const localeCode = localeName === 'lzh' ? 'zh' : localeName;
    const getWeekNames = (format) => [...Array(7).keys()].map((day) =>
        new Intl.DateTimeFormat(localeCode, { weekday: format }).format(new Date(Date.UTC(2021, 5, day)))
    );
    const getMonthNames = (format) => [...Array(12).keys()].map((month) =>
        new Intl.DateTimeFormat(localeCode, { month: format }).format(new Date(Date.UTC(2021, month, 2)))
    );

    return {
        monthNames: getMonthNames('long'),
        monthNamesShort: getMonthNames('short'),
        dayNames: getWeekNames('long'),
        dayNamesShort: getWeekNames('short'),
    };
}

async function translateSingle(value, desiredLanguage, retryCount = 3, delay = 1000) {
    const url = 'https://api.cognitive.microsofttranslator.com/translate';
    const apiKey = process.env.API_KEY;
    const region = process.env.API_REGION;

    const params = {
        'api-version': '3.0',
        'to': desiredLanguage
    };

    const dataToTranslate = [{ text: value }];

    for (let attempt = 1; attempt <= retryCount; attempt++) {
        try {
            const response = await axios.post(url, dataToTranslate, {
                params: params,
                headers: {
                    'Content-Type': 'application/json',
                    'Ocp-Apim-Subscription-Key': apiKey,
                    'Ocp-Apim-Subscription-Region': region,
                }
            });

            return response.data[0].translations[0].text;
        } catch (error) {
            console.error(`Erro ao traduzir "${value}" (tentativa ${attempt} de ${retryCount}):`, error.message);
            
            if (attempt < retryCount) {
                console.log(`Tentando novamente em ${delay}ms...`);
                await sleep(delay); // Pausa antes da próxima tentativa
                delay *= 2; // Exponential backoff: aumenta o tempo de espera a cada tentativa
            } else {
                throw new Error(`Erro persistente ao traduzir "${value}" após ${retryCount} tentativas.`);
            }
        }
    }
}

// Função recursiva para verificar chaves aninhadas
function findMissingKeys(source, target) {
    const missingKeys = {};

    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            const sourceValue = source[key];
            const targetValue = target ? target[key] : undefined;

            if (typeof sourceValue === 'object' && !Array.isArray(sourceValue) && sourceValue !== null) {
                // Se for um objeto aninhado, busca as chaves faltantes recursivamente
                const nestedMissing = findMissingKeys(sourceValue, targetValue);
                if (Object.keys(nestedMissing).length > 0) {
                    missingKeys[key] = nestedMissing;
                }
            } else if (!targetValue) {
                // Se a chave estiver faltando, adiciona ao objeto de chaves faltantes
                missingKeys[key] = sourceValue;
            }
        }
    }

    return missingKeys;
}

async function translateAndSaveNestedObject(obj, desiredLanguage, filePath) {
    let existingTranslations = {};

    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        existingTranslations = JSON.parse(fileContent);
    }

    // Identifica apenas as chaves faltantes
    const missingKeys = findMissingKeys(obj, existingTranslations);
    
    if (Object.keys(missingKeys).length === 0) {
        console.log(`Nenhuma chave faltante para ${desiredLanguage}`);
        return;
    }

    const translatedData = await translateNestedObject(missingKeys, desiredLanguage);

    // Mescla as traduções novas com as já existentes
    const mergedData = { ...existingTranslations, ...translatedData };

    fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2), 'utf8');
    console.log(`Arquivo de tradução salvo com sucesso em ${filePath}`);
}

async function translateNestedObject(obj, desiredLanguage) {
    const translatedObj = {};

    for (const [key, value] of Object.entries(obj)) {
        console.log(`Traduzindo chave: ${key}`);
        if (typeof value === 'string') {
            translatedObj[key] = await translateSingle(value, desiredLanguage);
        } else if (Array.isArray(value)) {
            translatedObj[key] = await Promise.all(
                value.map(async (item) => (typeof item === 'string' ? await translateSingle(item, desiredLanguage) : item))
            );
        } else if (typeof value === 'object' && value !== null) {
            translatedObj[key] = await translateNestedObject(value, desiredLanguage);
        } else {
            translatedObj[key] = value;
        }
    }

    return translatedObj;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function translateAllKeys(desiredLanguage, sourceOption) {
    const sourceData = sourceOption === MOVE_TYPE.APP 
        ? formatAppLanguage(appLanguage)
        : classLanguage;

    const filePath = sourceOption === MOVE_TYPE.APP 
        ? `./languages/MoveApp/${desiredLanguage}.json`
        : `./languages/MoveClass/${desiredLanguage}.json`;

    await translateAndSaveNestedObject(sourceData, desiredLanguage, filePath);

    if (sourceOption === MOVE_TYPE.APP && calendarOption) {
        const calendarToday = await translateSingle("Hoje", desiredLanguage);
        const calendarData = daysForLocale(desiredLanguage);

        calendarData.today = calendarToday;

        let existingTranslations = {};

        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            existingTranslations = JSON.parse(fileContent);
        }

        existingTranslations.calendar_locale = calendarData;

        fs.writeFileSync(filePath, JSON.stringify(existingTranslations, null, 2), 'utf8');
    }

    console.log(`✅ Todas as chaves foram traduzidas para ${desiredLanguage}.json com sucesso.`);
}

async function translateForAllLanguages(sourceOption) {
    for (const language of LANGUAGES) {
        console.log(`🔄 Iniciando tradução para o idioma: ${language}...`);
        await translateAllKeys(language, sourceOption); // Tradução para cada idioma
        console.log(`✅ Tradução concluída para o idioma: ${language}.`);
    }
    console.log("🚀 Todas as traduções foram concluídas!");
}

const reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function askCalendarLocale() {
    reader.question(
        `Inserir chave calendar_locale? (S/N)\n`, 
        (answer) => {
            calendarOption = answer.trim().toUpperCase() === 'S';
            translateForAllLanguages(sourceOption).then(() => {
                console.log("✅ Processo de tradução para todas as linguagens concluído.");
                reader.close();
            });
        }
    );
}

function askQuestion() {
    reader.question(`
Escolha a opção de aplicação a ser traduzida:
1️⃣ - Move App 📱
2️⃣ - Move Class 💻
9️⃣ - Encerrar a aplicação ❌
Digite o número correspondente: 
`, (appOption) => {
        sourceOption = Number(appOption.trim());

        if (sourceOption === MOVE_TYPE.APP || sourceOption === MOVE_TYPE.CLASS) {
            console.log(`${sourceOption === MOVE_TYPE.APP ? 'App' : 'Class'} Selecionado`);
            if (sourceOption === MOVE_TYPE.APP) {
                askCalendarLocale();
            } else {
                translateForAllLanguages(sourceOption).then(() => {
                    console.log("✅ Processo de tradução para todas as linguagens concluído.");
                    reader.close();
                });
            }
        } else if (sourceOption === 9) {
            console.log("Tradutor Encerrado");
            reader.close();
        } else {
            console.log("Opção Inválida\n");
            askQuestion();
        }
    });
}

// Inicia o fluxo de perguntas
askQuestion();
