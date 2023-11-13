// SETUP

// time.php - текущее время сервера

const CT = chrome.tabs;
const CW = chrome.windows;
const CR = chrome.runtime;
const CN = chrome.notifications;
const CSL = chrome.storage.local;

const CURRENT_VERSION = CR.getManifest().version;

const POST_PARAMS = {
    method: 'POST',
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
}

const REDIRECT = {
    redirect: 'manual'
}

const NOTIF_OPT = {
    priority: 2,
    silent: true,
    contextMessage: 'HWM Tool'
}

let HOST = 'https://my.lordswm.com'; // хост поумолчнию
window.HOST = HOST;
const SECTIONS = ['mn', 'fc', 'sh'];
const STATPAGE = '/get_pl_status_for_flash_map.php'; // статус игрока
const MAP_REGEXP = /map.php/;
const MAP = `/${MAP_REGEXP.source}`;
const HOME = '/home.php';

const ICON = 'img/icon_128.png';
let IMG_LINK, B_ICON, GRICON, GNFACE, GOFACE, GLFACE, GVFACE;

const _HELLO = ['Привет', 'Здравствуй'];
const _HELLO2 = ['Доброе утро', 'Добрый день', 'Добрый вечер', 'Доброй ночи'];
const _GR = 'Гильдия Рабочих';
const _GN = 'Гильдия Наёмников';
const _GO = 'Гильдия Охотников';
const _GL = 'Гильдия Лидеров';
const _GV = 'Гильдия Воров';

const TRAVEL = /"map_star/;

const SPECIAL_ART = /potion|thief_paper|part_|sec_|dom_|sha_|abrasive|snake_poison|tiger_tusk|ice_crystal|moon_stone|fire_crystal|meteorit|witch_flower|wind_flower|fern_flower|badgrib|\b[1-6]\b/; // арты без прочности

const INIT_OPTIONS = {
    login: false,           // статус логина
    busystate: null,        // используется во время сохранения\загрузки билдов
    userID: "default",      // id текущего игрока - для записи настроек и т.п.
    update_previous: null,  // предыдущая версия обновления
    update_version: null,   // текущая версия файла обновления
    update_ignore: null,    // не напоминать о версии

    workcode: null,         // сохранённый код
    workdata: null,         // данные движения мыши и прочая защита

    gv_koef: 0,             // коэффициент ускорения таймера ГВ в праздники
    gv_pryanik: false,      // ускорение от пряника\плюшки х5
    gv_boost: false,        // ускорение ГВ
    abubekr: false,         // наличие абу-бекра

    sector: null,           // текущий сектор игрока
    trackto: null,          // назначение перемещения (player, hunter, object)
    objid: null,            // id объекта назначения

    // дефолтные настройки для нового пользователя
    default_buildlist: {},      // сохранённые билды
    default_build_current: '',  // текущий билд

    default_tavern: true,       // таверна
    default_rulette: false,     // рулетка
    default_chat: true,         // чат

    default_informator: true,   // информатор
    default_color: '#8000ff',   // цвет информатора

    default_battlealert: true,  // напоминание о заявке
    default_sound: false,       // звук

    default_tradehelp: true,    // отслеживание лотов
    default_tradetime: 15,      // таймер рынка
    default_tradelist: {},      // сохранённые лоты
    default_tradefound: {},     // найденные лоты
    default_extMarketFilter: true,// фильтр лотов для сравнения цен в магазине (Только продажа или Все) 
    default_extSort: true,      // сортировка рынка по умолчанию
    default_extSortType: 204,   // тип (цена боя: по возрастанию)

    default_aucbtns: true,      // кнопки быстрого поиска и продажи
    default_ifilters: true,     // фильтры инвентаря  
    default_smartbg: true,      // умный фон артефактов  
    default_mtrans: false,      // передача артов пачкой
    default_translist: {},      // список артов для передачи

    default_htimer: true,       // таймер восстановления
    default_ttimer: true,       // таймер перемещения
    default_fasttravel: true,   // ссылки быстрого перемещения
    default_protocol: true,     // парсер протокола передач

    default_gtimers: true,      // таймеры гильдий
    default_gtpos: 'top-left',  // позиция таймеров
    default_gtstyle: 'dark',    // цвет таймеров

    default_goAlert: false,     // уведомление ГО
    default_gnAlert: false,     // уведомление ГН
    default_glAlert: false,     // уведомление ГЛ
    default_gvAlert: false,     // уведомление ГВ
    default_jobseek: true,      // автопоиск работы

    default_gnBot: true,        // автомаршруты в ГН

    default_key: null,          // ключ активации
}


let windowID, tabID, urlPATH, tabsSet = new Set(), pageDATA, base, inFocus = true, userID = "default", pl_lvl, pl_name, SIGN;
let _nojobTimer = null, jobID;
let _restTimer = null, restShow = false, restoration_h, restoration_t, startTime;
let _travelTimer = null, travelShow = false, _trackto = null, _objid = null;
let _battleTimer = null;
let cancel_duel, accept_duel, _duelTimer = null, alertclicked = false;

window.tabsSet = tabsSet; // делаем переменную доступной извне (для Popup)

// Таймеры

// торговый
let _tradeTimer = null, tradeCallback = { 'content': 'tradeTimer' }, tradeOnstop = () => { tradeService() };
// ГР
let grFirstCheck = true, showNews = false, _grTimer = null, grCallback = { 'content': 'gtimers', 'guild': 'gr' }, grOnstop = () => { _grTimer = null; getJob() };
// ГО
let goChecked = false, _go_help_waiter = null;
let _goTimer = null, goCallback = { 'content': 'gtimers', 'guild': 'go' }, goOnstop = () => { goChecked = false, _goTimer = null; goService(null) };
// ГН
let gnChecked = false, gn_task = false;
let _gnTimer = null, gnCallback = { 'content': 'gtimers', 'guild': 'gn' }, gnOnstop = () => { gnChecked = false, _gnTimer = null; gnService(null) };
// ГЛ
let glChecked = false;
let _glTimer = null, glCallback = { 'content': 'gtimers', 'guild': 'gl' }, glOnstop = () => { glChecked = false, _glTimer = null; glService(null) };
// ГВ
let gvChecked = false, _gv_battle_waiter = null, thief_on = false;
let _gvTimer = null, gvCallback = { 'content': 'gtimers', 'guild': 'gv' }, gvOnstop = () => { gvChecked = false, _gvTimer = null; gvService(null) };


// Теневая загрузка страниц
const loadPage = async url => {
    try { return new TextDecoder('windows-1251').decode(new DataView(await (await fetch(url)).arrayBuffer())); } catch (e) { errorAlert(); }
}

// Парсинг страниц
// gr2 = true - использовать группу 2 regex 
// на выходе получаем Array [group1..., group2...]
const parsePage = (page, reg, gr2 = false) => [...page.matchAll(reg)].flatMap(i => gr2 ? [i[1], i[2]] : i[1]); // продвинутый вариант

// Получаем объект storage.local
const getStorage = () => new Promise(resolve => CSL.get(null, storage => resolve(storage)));
// Запись значений в storage.local
const setStorage = obj => CSL.set(obj);


chrome.browserAction.setIcon({ path: 'img/icon.png' }); // При загрузке бэкграунда ставим иконку стандартную
setStorage({ userID: 'default', login: false, busystate: null, workcode: null, workdata: null, update_version: null }); // Обнуляем значения логина, занятости, кода работы и текущей версии

// Загружаем базу
fetch('base.json').then(response => {
    response.json().then(data => {
        base = data;
    });
});


// END SETUP

// Проверка версии файла обновления
(async () => {
    await loadPage(HOST + '/pl_info.php?id=7383886').then(page => {
        const version = /\[(\d.\d+.\d+)\]/.exec(page);
        if (version && version[1] !== CURRENT_VERSION) setTimeout(() => {
            setStorage({ update_version: version[1] });
        }, 1000);
    })
})();


//Обновление доступно, установка после перезапуска браузера
// CR.onUpdateAvailable.addListener(details => {
//     console.log(details.version);
// });

// Обновление и первая установка расширения
CR.onInstalled.addListener(details => {
    // Записываем номер версии при обновлении
    // if (details.reason == "update") setTimeout(() => {
    //     /*
    //         Здесь можно вносить изменения после обновления, изменение пользовательских параметров и т.п.
    //     */
    //     setStorage({ update: CR.getManifest().version });
    // }, 1000);

    // Инициализируем настройки при установке расширения
    if (details.reason == "install") setStorage(INIT_OPTIONS);
});


/* ОБРАБОТКА СОБЫТИЙ БРАУЗЕРА */

const browserEvents = () => {

    // Переключение между вкладками
    CT.onActivated.addListener(activeInfo => tabSelector(activeInfo.tabId));

    // Убираем из массива id закрытой вкладки с игрой и переназначаем tabID на одно из значений из коллекции вкладок,
    // на случай, если после закрытия вкладки переключение происходит не на вкладку с игрой
    CT.onRemoved.addListener(tabId => {
        tabsSet.delete(tabId);
        if (tabsSet.size > 0) tabID = [...tabsSet][0];
    });

    // Переключение между окнами браузера
    CW.onFocusChanged.addListener(windowId => {
        if (windowId != -1) {
            CW.getAll({ populate: true }, windows => {
                const currentWindow = windows.filter(window => window.id == windowId); // получаем объект текущего окна со всеми вкладками
                const activeTab = currentWindow[0].tabs.filter(tab => tab.active); // получаем активную вкладку
                tabSelector(activeTab[0].id);
            });
        }
    });

    // Убираем все уведомления, если закрывается последнее окно браузера
    CW.onRemoved.addListener(() => CW.getAll(windows => windows.length == 0 && clearAllNotif()));
}

const tabSelector = id => {
    if (tabsSet.has(id)) {
        // если новая вкладка относится к игре, начинаем ссылаться на неё (tabID)
        tabID = id, inFocus = true;
        // очищаем значения таймеров на случай, если таймер закончил работу, пока мы были на другой вкладке
        let mes = { 'content': 'gtimers' };
        if (!_goTimer) mes['goStatus'] = _go_help_waiter ? 'waiting' : 'goReady';
        if (!_gnTimer) mes['gnStatus'] = gn_task ? 'task' : 'gnReady';
        if (!_grTimer) mes['grStatus'] = 'grReady';
        if (!_glTimer) mes['glStatus'] = 'glReady';
        if (!_gvTimer) mes['gvStatus'] = _gv_battle_waiter ? 'ambush' : 'gvReady';

        CT.sendMessage(tabID, mes);
    } else {
        inFocus = false;
    }
}


// ПРОВЕРКА СТАТУСА ИГРОКА
// Возвращаемые значения:

// otherarc - карточная игра
// otherin_arc_list - в заявке на карточную игру
// otherin_arc_tourn - в ожидании карточного турнира

// otherin_list - групповые пвп, охота, ГРж
// otherin_thief - ГВ
// otherin_pvp_guild_req - ГТ
// otherin_duel_list - дуэли
// otherin_bat_req - бои за территории (клановые)

// otherin_fast_tourn - Быстрый турнир
// otherin_t_list - Парный турнир, МТ++
// otherin_gw_list - Портал, Охота на Пиратов
// otherin_event - Великое состязание (Грифоны - Мантикоры), Отголоски Инферно

// otherin_quest - квест

// otherwar_auto - автобой ГО\ГН
// otherwar_auto_done - после автоГО\автоГН

// otherbusy - перемещение по карте в Поисках сокровищ (?)

// inwar - в бою
// оtherfree - по умолчанию
// noauth - не авторизован

const PREBATTLE = /otherin_list|otherin_thief|otherin_pvp_guild_req|otherin_fast_tourn|otherin_t_list|otherin_bat_req|otherin_gw_list|otherin_event/; // статусы заявок в боях
const getStatus = async () => {
    try { return await (await fetch(HOST + STATPAGE)).text(); } catch (e) { errorAlert(); }
}

// Сообщение об ошибке загрузки
const errorAlert = () =>
    CN.create('error', {
        type: 'basic',
        iconUrl: ICON,
        title: 'Ошибка загрузки страницы!',
        message: 'Нет подключения к Интернету или ресурс временно недоступен.',
        ...NOTIF_OPT
    });



// Проверяем статус игрока. Должен быть залогинен и не находиться в битве и т.п.
// Если статус undefined, значит нет интернета либо доступа к сайту
// Проверяем не перемещается ли игрок по карте
// Возвращаем false или true
// Используется Отслеживанием лотов и таймерами Гильдий

const safetyLoad = async () => {
    const status = await getStatus();
    return !/undefined|inwar|otherarc|otherin_quest|otherwar_auto|noauth/.test(status) && !TRAVEL.test(pageDATA);
};


// Проверка URL на наличие нужных значений (true/false)
const testURL = reg => reg.test(urlPATH);


class Timer {
    // Время окончания, название сообщения для колбека в контент, функция по окончанию таймера 
    constructor(endtime, callback, onstop) {
        this.endtime = endtime;
        this.callback = callback;
        this.onstop = () => onstop();
    }
    tick() {
        this.starttime = new Date().getTime() + 1;
        let offset = this.endtime - this.starttime;
        let m = offset / 60000 | 0;
        let s = ((offset % 60000) / 1000) | 0;

        CT.sendMessage(tabID, { ...this.callback, 'timer': [m < 10 ? '0' + m : m, s < 10 ? '0' + s : s] });

        if (offset > 0) {
            this._Timer = setTimeout(() => { this.tick() }, 1000);
        } else {
            this.onstop();
        }
    }
    clear() {
        clearTimeout(this._Timer);
    }
}



// Прослушивание и обработка сообщений из content, popup
CR.onMessage.addListener(async (request, sender, response) => {

    if (sender.tab) {

        windowID = sender.tab.windowId;
        tabID = sender.tab.id;

        tabsSet.add(tabID);
    }

    // Получаем userID, urlPATH и DATA из content
    if (request.userID) {

        userID = request.userID, urlPATH = request.urlPATH, pageDATA = request.DATA;

        const storage = await getStorage();
        // отслеживание переключения между вкладками с двумя разными хостами и разными логинами
        if (storage.login && storage.userID != request.userID) {
            CT.sendMessage(tabID, { 'content': 'loc_reload' }); //перезагрузка content
            location.reload();
            clearAllNotif();
        }
    }

    // Игрок на странице боя
    if (request.inWar) urlPATH = request.inWar;


    // Разлогинился
    if (request.logout) {
        location.reload();
        clearAllNotif();
    }


    // Залогинился
    if (request.login) {

        HOST = sender.origin;
        window.HOST = HOST;
        IMG_LINK = /lordswm/.test(HOST) ? 'https://cfcdn.lordswm.com/i/' : 'https://dcdn.heroeswm.ru/i/';

        B_ICON = `${IMG_LINK}new_top/_panelBattles.png`; // иконка битвы
        GRICON = `${IMG_LINK}getjob/btn_work.png`;
        GNFACE = `${IMG_LINK}gn_face.png`;
        GOFACE = `${IMG_LINK}go_face.png`;
        GLFACE = `${IMG_LINK}combat/map/btn_leader.png`;
        GVFACE = `${IMG_LINK}gv_face.png`;


        browserEvents(); // инициализируем ивенты браузера

        // Проверка на наличие Абу-Бекра
        const { abubekr, shopdata } = await AbuTest();

        if (shopdata == null) return // запуск расширения во время перемещения игрока или нахождения в бою и т.п. - прерываем логин
        SIGN = /sign="(\w+)/.exec(shopdata)[1]; // сохраняем sign

        const page = await loadPage(`${HOST}/pl_info.php?id=${userID}`);
        pl_name = /<title>([\wа-яё\-\(\) ]+) \|/i.exec(page)[1]; // никнейм игрока
        pl_lvl = +/уровень: (\d+)/.exec(page)[1]; // уровень игрока
        const sector = /\d">([\w' ]+)/.exec(page)[1]; // сектор игрока

        // Проверка на наличие ГВ
        thief_on = /Воров: \d+ \([\d.]+\) <f/.test(page);
        // Проверка на ускорение ГВ
        const gv_boost = /<i>.+?Воров до/.test(page);
        // Проверка на Пряник\Плюшку
        const gv_pryanik = /i>Съел (?:пряник|плюшку)/.test(page);

        const status = await getStatus();

        // Проверка на засаду в ГВ
        if (thief_on && status == 'otherin_thief') await gvBattleWaiter();


        // Проверка на ускорение таймера ГВ в праздники
        const gv_koef = await getPercents();

        // Определяем время и формируем приветствие
        let hour = new Date().getHours();
        let n;

        if (hour >= 5 && hour < 10) n = 0;
        if (hour >= 10 && hour < 17) n = 1;
        if (hour >= 17 && hour < 22) n = 2;
        if (hour >= 22 || hour < 5) n = 3;

        _HELLO.push(_HELLO2[n]);
        let hello = _HELLO[Math.random() * 3 | 0];

        const storage = await getStorage();

        // Проверка на нахождение в заявке с установкой таймера
        if (storage[userID + "_battlealert"]) {
            !_battleTimer && PREBATTLE.test(status) && battleTimer(status);
            !_duelTimer && status == 'otherin_duel_list' && duelTimer(status);
        }

        // Запускаем таймер рынка, если включен
        storage[userID + "_tradehelp"] && tradeTicker(storage[userID + "_tradetime"]);

        const update_version = storage.update_version;

        if (update_version && update_version !== storage.update_ignore) {

            CN.create('new_version', {
                type: 'basic',
                iconUrl: ICON,
                title: `${hello}, ${pl_name}!`,
                message: `Доступно обновление ${update_version} >>`,
                buttons: [{ 'title': 'Скачать файл' }, { 'title': 'Не напоминать' }],
                requireInteraction: true,
                ...NOTIF_OPT
            });

        } else {

            const isUpdated = storage.update_previous !== CURRENT_VERSION;
            CN.create(isUpdated ? 'update' : 'welcome', {
                type: 'basic',
                iconUrl: ICON,
                title: `${hello}, ${pl_name}!`,
                message: isUpdated ? `Установлено обновление ${CURRENT_VERSION} >>` : '',
                requireInteraction: isUpdated ? true : false,
                ...NOTIF_OPT
            });
        }

        if (storage[userID + "_key"] && checkKey(storage[userID + "_key"]) == false) setStorage({ [userID + "_key"]: null }); // проверка на случай фиктивного ключа

        setStorage({ login: true, update_previous: CURRENT_VERSION, abubekr, gv_koef, gv_boost, gv_pryanik, sector });

        chrome.browserAction.setIcon({ path: 'img/icon_on.png' }); // Устанавливаем значок

        gtWorker(); // запускаем таймеры

        CR.sendMessage({ 'popup': 'reload' }); // перезагружаем попап, как только бэкграунд полностью завершит логин и сохранение настроек
    }


    // Проверка лицензионного ключа
    if (request.verifykey) {

        if (checkKey(request.verifykey)) {

            setStorage({ [userID + "_key"]: request.verifykey });
            CR.sendMessage({ 'popup': 'keyaccept' });

        } else {
            CR.sendMessage({ 'popup': 'keyreject' });
        }
    }


    //Принимаем значение здоровья из content и запускаем Таймер восстановления
    if (request.restoration_h < 100) {
        if (!restShow) {
            CN.create('restTimer', {
                type: 'progress',
                iconUrl: ICON,
                title: 'Восстановление армии',
                message: '',
                progress: 0,
                ...NOTIF_OPT
            });
            restShow = true;
        }

        if (!_restTimer) {

            startrestTimer(request);

        } else if (_restTimer && restoration_t != request.restoration_t) {
            // перезапускаем таймер, если во время восстановления поменялось значение времени

            clearInterval(_restTimer);
            startrestTimer(request);

        }
    }

    if (request.restoration_h == 100 && _restTimer) armyReady();


    // удаляем таймер восстановления, если галочка опции снята
    if (request.del_resttimer && _restTimer) {
        clearInterval(_restTimer);
        restShow = false;
        _restTimer = null;
        CN.clear('restTimer');
    }


    // Таймер перемещения
    if (request.travel_time) {

        clearAllNotif();

        const storage = await getStorage();

        let txt = '';

        _trackto = storage.trackto;
        _objid = storage.objid;

        if (_trackto == 'object') txt = 'на объект';
        if (_trackto == 'hunter') txt = 'к охотнику';
        if (_trackto == 'player') txt = 'к игроку';
        if (_trackto == 'gn-start') txt = 'на задание ГН';
        if (_trackto == 'gn-end') txt = 'в ГН';

        if (!travelShow && storage[userID + "_ttimer"]) {

            CN.create('travelTimer', {
                type: 'progress',
                iconUrl: ICON,
                title: `Перемещение ${txt}`,
                message: '',
                progress: 0,
                ...NOTIF_OPT
            });
            travelShow = true;
        }

        // добавляем 1 секунду, если перемещение к охотнику, на объект или ГН
        if (!_travelTimer) startTravelTimer(storage, request.travel_time + (/object|hunter|gn-end/.test(_trackto) ? 1 : 0));
    }


    /* РЫНОК: Отслеживание лотов */

    // запуск таймера
    if (request.tradehelp && !_tradeTimer) tradeTicker();


    // Отключение таймера рынка
    if (request.tradehelp_off && _tradeTimer) {
        _tradeTimer.clear();
        _tradeTimer = null;
    }

    // Перезапуск таймера рынка при переключении значения таймера в popup
    if (request.tradetimer_relaunch && _tradeTimer) {
        _tradeTimer.clear();
        _tradeTimer = null;
        tradeTicker(request.tradetime);
    }


    // Напоминание о заявке
    if (request.battlealert && !_battleTimer) {
        const status = await getStatus();
        PREBATTLE.test(status) && battleTimer(status);
    }

    // Заявки в дуэлях
    if (request.duelalert && !_duelTimer) {
        const status = await getStatus();
        status == 'otherin_duel_list' && duelTimer(status);
    }

    // Отмена заявки на дуэль
    if (request.duelcancel) {
        clearTimeout(_duelTimer);
        _duelTimer = null;
    }

    // Отмена засады ГВ
    if (request.ambushcancel) {
        clearTimeout(_battleTimer);
        _battleTimer = null;
    }


    //Запросы в базу
    if (request.get_base) response({ 'base': base });


    // Мастер билдов
    if (request.savebuild) saveBuild(request.name);
    if (request.loadbuild) loadBuild(request.name);

    // Cтатус игрока для popup
    if (request.getstatus) {
        const status = await getStatus();
        CR.sendMessage({ 'pl_status': status == undefined ? 'offline' : status, 'travel_status': _travelTimer });
    }


    // Обновление значений на странице Гильдии Воров
    if (request.gv_refresh) {
        // Проверка на наличие Абу-Бекра
        const { abubekr } = await AbuTest();

        const page = await loadPage(`${HOST}/pl_info.php?id=${userID}`);
        const gv_boost = /<i>.+?Воров до/.test(page);
        const gv_pryanik = /i>Съел (?:пряник|плюшку)/.test(page);

        const gv_koef = await getPercents();

        setStorage({ abubekr, gv_koef, gv_boost, gv_pryanik });

        if (_gvTimer) {
            gvChecked = false;
            _gvTimer.clear();
            _gvTimer = null;
        }

        CT.sendMessage(tabID, { 'content': 'loc_reload' }); //перезагрузка content
    }


    // ГН Бот
    if (request.gnAccept) {
        gnChecked = gn_task = true;
    }

    if (request.gnClear) {
        gnChecked = false;
        gn_task = false;
    }

    if (request.glClear) glChecked = false;

    if (request.goClear) goChecked = false;
    if (request.goHelp) goHelpWaiter();
    if (request.goPass) goTimer(request.SECONDS); // пропуск охоты, запуск таймера вручную

    // Таймеры гильдий
    if (request.gtimers) gtWorker();

});


const AbuTest = async () => {
    const page = await loadPage(`${HOST}/shop.php?cat=other`);
    const shopdata = TRAVEL.test(page) ? null : page;
    return { abubekr: /Бекра д/.test(page), shopdata }
}


// Вычисление процента ускорения ГВ в праздники
const getPercents = async () => {
    const serv_time = await loadPage(`${HOST}/time.php`);
    const date = /(\d+)-(\d+)/.exec(serv_time);
    const day = +date[1], month = +date[2];

    let perc = 0;

    /*  if (month == 3 && day >= 1 && day <= 5) perc = 92.83; // др игры */
    if ((month == 12 && day == 31) || (month == 1 && day >= 1 && day <= 3)) perc = 40; // новый год
    return perc;
}


// Проверка ключей
const checkKey = k => {
    let c, i = 0, h = +userID;
    while (c = pl_name.charCodeAt(i++)) h = ((h << 5) + h) + c;
    return BigInt(h * h).toString(36) == k;
}

// Таймеры гильдий
const gtWorker = () => {
    goService(pageDATA);
    gnService(pageDATA);
    glService(pageDATA);
    gvService(pageDATA);
    grService(pageDATA);
}


// Таймер перемещения

const startTravelTimer = (storage, ttime) => {

    let t = ttime;

    _travelTimer = setInterval(async () => {

        ttime--;

        CN.update('travelTimer', {
            message: `Осталось ${ttime} сек.`,
            progress: 100 - ttime / t * 100 | 0
        });

        if (ttime == 0) {

            clearInterval(_travelTimer);
            _travelTimer = null;

            // Перепроверяем ГО после окончания перемещения, если таймера нет и игрок не на карте
            if (!testURL(MAP_REGEXP) && !_goTimer) goChecked = false;

            // Если таймер отключен или был выключен во время работы
            if (!storage[userID + "_ttimer"] || !travelShow) {

                let txt = 'Открыть карту >>';
                if (_trackto == 'object') txt = 'Открыть страницу объекта >>';
                if (_trackto == 'hunter') txt = 'Открыть Групповые бои >>';
                if (_trackto == 'gn-end') txt = 'Открыть Гильдию Наёмников >>';

                // Если перемещение к игроку или простое перемещение,
                // то находясь на карте, выводим простое уведомление без интерактива
                if (testURL(MAP_REGEXP) && !/object|hunter|gn-end/.test(_trackto)) {
                    travelDoneAlert();
                } else {
                    CN.create('traveldone', {
                        type: 'basic',
                        iconUrl: ICON,
                        title: 'Перемещение завершено!',
                        message: txt,
                        requireInteraction: true,
                        ...NOTIF_OPT
                    });
                }

            } else {
                // Автоматическая переадресация на нужную страницу
                let url = HOST + MAP;
                if (_trackto == 'object') url = `${HOST}/object-info.php?id=${_objid}`;
                if (_trackto == 'hunter') url = `${HOST}/group_wars.php?filter=hunt`;
                if (_trackto == 'gn-end') url = `${HOST}/mercenary_guild.php`;

                (testURL(MAP_REGEXP) && !/object|hunter|gn-end/.test(_trackto)) ? tabActivator(tabID) : tabWorker(url);

                travelDoneAlert();
            }

            setStorage({ [userID + "_trackto"]: null });
            CN.clear('travelTimer');
            travelShow = false;
        }
    }, 1000);
}

const travelDoneAlert = () => {
    CN.create('traveldone2', {
        type: 'basic',
        iconUrl: ICON,
        title: 'Перемещение завершено!',
        message: '',
        ...NOTIF_OPT
    });
}


// Таймер готовности армии

const startrestTimer = request => {
    restoration_h = request.restoration_h - 1; // корректировка для того, чтоб таймер чуть запаздывал
    restoration_t = request.restoration_t;
    startTime = new Date().getTime();
    restTimer();
}

const restTimer = () => {

    let curTime = new Date().getTime();
    let curHealth = restoration_h + 100 / restoration_t * ((curTime - startTime) / 1000);

    let date = new Date(null);
    date.setSeconds((100 - curHealth) * restoration_t / 100) | 0; // оставшееся время до восстановления в секундах

    let timer = date.toISOString().substr(14, 5);

    curHealth = curHealth | 0;

    if (curHealth == 100) {
        armyReady();
    } else {
        CN.update('restTimer', {
            message: 'Времени осталось: ' + timer,
            progress: curHealth
        });
        _restTimer = setTimeout(restTimer, 1000);
    }
}

const armyReady = () => {
    clearInterval(_restTimer);
    _restTimer = null;

    CN.clear('restTimer');
    restShow = false;

    // создаем нотификацию об окончании
    CN.create('restored', {
        type: 'basic',
        iconUrl: ICON,
        title: 'Ваша армия полностью восстановлена!',
        message: inFocus ? '' : 'Вернуться в игру >>',
        ...NOTIF_OPT
    });
}


// Отслеживание лотов

const tradeService = async () => {

    _tradeTimer.clear();
    _tradeTimer = null;

    const storage = await getStorage();

    const tradelist = storage[userID + "_tradelist"];
    const tradetime = storage[userID + "_tradetime"];

    if (Object.keys(tradelist).length > 0) {

        const safe = await safetyLoad();

        if (safe) {

            let tradefound = {}, promises = [], cur_lot_name = '';

            for (let lot in tradelist) {

                promises.push(

                    loadPage(`${HOST}/auction.php?${tradelist[lot][3]}`).then(page => {

                        let query = /<div id="au\d+".+?>([\d,]+)/.exec(page);

                        if (query) {

                            let price = +query[1].replace(/,/g, ''); // цена

                            if (SPECIAL_ART.test(lot)) {
                                if (price < tradelist[lot][2]) {
                                    tradefound[lot] = price;
                                    cur_lot_name = tradelist[lot][0];
                                }
                            } else {
                                let strength = /<BR>Прочность: .*?(\d+)/.exec(page)[1]; // прочность
                                let battlepay = +(price / strength).toFixed(2);

                                if (battlepay < tradelist[lot][2]) {
                                    tradefound[lot] = battlepay;
                                    cur_lot_name = tradelist[lot][0];
                                }
                            }
                        }
                    })
                );
            }

            await Promise.all(promises);

            const keysCount = Object.keys(tradefound).length;

            if (keysCount > 0) {

                let txt = `Перейти на Рынок >>`;

                if (keysCount == 1) {
                    txt = `>> ${cur_lot_name}`
                } else if (testURL(/auction.php$|cat=my/)) {
                    txt = 'Обновить страницу >>'
                }

                CN.create('tradefound', {
                    type: 'basic',
                    iconUrl: ICON,
                    title: `Обнаружены подходящие лоты [${keysCount}]`,
                    message: txt,
                    requireInteraction: true,
                    ...NOTIF_OPT
                });

            }

            setStorage({ [userID + "_tradefound"]: tradefound });

            tradeTicker(tradetime);

        } else {

            tradeTicker(tradetime);
        }
    }
}

const tradeTicker = async t => {

    if (!_tradeTimer) {

        const storage = await getStorage();

        t = t || storage[userID + "_tradetime"];

        // Проверка ключа, если таймер менее 5 минут, на случай ручного ввода времени через popup (hack)
        if (t < 5 && checkKey(storage[userID + "_key"]) == false) {

            setStorage({ [userID + "_tradetime"]: 15 });
            startTradeTimer(15);

        } else startTradeTimer(t);
    }
}

const startTradeTimer = t => {
    let endtime = new Date().getTime() + t * 60000;
    _tradeTimer = new Timer(endtime, tradeCallback, tradeOnstop);
    _tradeTimer.tick();
}


// ОПОВЕЩЕНИЯ О ЗАЯВКЕ

// Дуэли
const duelTimer = async status => {

    if (status == 'otherin_duel_list') {

        if (testURL(/one_to_one/)) {
            duelCheck(pageDATA);
        } else {
            const page = await loadPage(`${HOST}/one_to_one.php`);
            duelCheck(page);
        }

    } else if (status == 'otherfree') {
        _duelTimer = null;

    } else {
        _duelTimer = setTimeout(async () => {
            const status = await getStatus();
            duelTimer(status);
        }, 10000);
    }
}

const duelCheck = data => {

    if (/\/mech\./.test(data)) {

        CN.getAll(notif => {

            if (!notif["duelfound"] && !alertclicked) {

                let player = /pl_info.php\?id=(\d+)['|"]>(.+])</.exec(data);
                accept_duel = player[1];
                cancel_duel = /[&|&amp;]id=(\d+)/.exec(data)[1];

                CN.create('duelfound', {
                    type: 'basic',
                    iconUrl: B_ICON,
                    title: player[2],
                    message: 'хочет с Вами сразиться. Согласиться?',
                    buttons: [{ 'title': 'Да' }, { 'title': 'Нет' }],
                    requireInteraction: true,
                    ...NOTIF_OPT
                });
                alertSound();
            }

            duelTimer(null);
        });

    } else if (/Ожидание согласия/.test(data)) {
        clearTimeout(_duelTimer);
        battleTimer(null, 15000);

    } else {
        CN.clear("duelfound");
        alertclicked = false;
        duelTimer(null);
    }
}

// Оповещения о заявках в групповых боях
const battleTimer = (status, delay = 10000) => {

    if (status == 'inwar') {
        _battleTimer = null;
        _duelTimer = null;

        CN.create('battlealert', {
            type: 'basic',
            iconUrl: B_ICON,
            title: 'Ваш бой уже начался! Вступить >>',
            message: '',
            requireInteraction: true,
            ...NOTIF_OPT
        });
        alertSound();

    } else if (status == 'otherfree') {
        _battleTimer = null;
        _duelTimer = null;

    } else {
        _battleTimer = setTimeout(async () => {
            const status = await getStatus();
            battleTimer(status);
        }, delay);
    }
}

// Звук оповещения
const alertSound = async () => {
    const storage = await getStorage();
    storage[userID + "_sound"] && new Audio('fanfare.mp3').play();
}


/* События Нотификаций*/

// Обновляем вкладку
const tabWorker = async (url, replace = true) => {

    CW.update(windowID, { focused: true }); // фокусируем окно браузера

    if (tabsSet.size == 0) {
        // если последняя вкладка с игрой закрыта, то создаем новую вкладку с требуемым url
        CT.create({ 'url': url });

    } else {

        tabActivator(tabID);   // вкладка с игрой обнаружена, переключаемся на неё

        if (/warid/.test(urlPATH)) {

            // игрок в бою, проверяем статус
            const status = await getStatus();

            if (status == 'inwar') {
                // если статус inwar, то проверяем совпадают ли id боев; если не совпадают, то обновляем вкладку
                const page = await loadPage(`${HOST}/pl_info.php?id=${userID}`);
                const cur_warid = /warid=(\d+)/.exec(urlPATH)[1];
                const target_warid = /warid=(\d+)/.exec(page)[1];

                if (cur_warid != target_warid) isContentExist(tabID, url);

            } else {
                isContentExist(tabID, url);
            }

        } else if (replace) {
            // Если replace = false, то по нажатию на уведомление ничего не делаем (по умолчанию - всегда обновляем страницу)
            isContentExist(tabID, url);
        }
    }
}

// Проверка отклика от content с попыткой обновить вкладку текущего tabID
const isContentExist = (tabID, url) => CT.sendMessage(tabID, { 'content': 'loc_replace', 'url': url }, r => {
    // создаём новую вкладку, если ответ от content не пришёл
    if (CR.lastError) {
        CT.create({ 'url': url });
        tabsSet.delete(tabID); // удаляем id
    }
});


// Делаем вкладку активной
const tabActivator = tab => CT.update(tab, { active: true });


// Убираем все уведомления
const clearAllNotif = () => CN.getAll(notif => {
    if (notif) {
        for (let key in notif) {
            CN.clear(key);
        }
    }
});


// Обработка событий клика по нотификации
CN.onClicked.addListener(async id => {

    if (id == 'travelTimer') {
        travelShow = false;
    }

    // Завершение перемещения после закрытого таймера
    if (id == 'traveldone') {

        let url = HOST + MAP;

        if (_trackto == 'object') url = `${HOST}/object-info.php?id=${_objid}`;
        if (_trackto == 'hunter') url = `${HOST}/group_wars.php?filter=hunt`;
        if (_trackto == 'gn-end') url = `${HOST}/mercenary_guild.php`;

        tabWorker(url);
    }

    if (id == 'update' || id == 'new_version') {
        CT.create({ 'url': 'https://sites.google.com/view/hwmtool/changelog' });
    }

    if (id == 'battlealert') {
        clearAllNotif();
        let url = HOST + HOME;
        tabWorker(url);
    }

    if (id == 'duelfound') {

        if (id == 'duelfound') alertclicked = true;
        let url = `${HOST}/one_to_one.php`;
        tabWorker(url);
    }

    if (id == 'restTimer') {
        restShow = false;
    }

    if (id == 'restored') {
        let url = HOST + HOME;
        tabWorker(url, false);
    }

    if (id == 'tradefound') {

        const storage = await getStorage();

        let url = `${HOST}/auction.php`;
        const tradefound = Object.keys(storage[userID + "_tradefound"]);

        // Если лот только один, то по нажатию переходим на страницу лота
        if (tradefound.length == 1) {
            const hot_lot = tradefound[0];
            url += `?${storage[userID + "_tradelist"][hot_lot][3]}`;
        }

        tabWorker(url);
    }

    if (/goReady|gvReady|nojob|job/.test(id)) {

        let url = HOST + MAP;
        tabWorker(url);
    }

    if (id == 'nojob') {
        clearInterval(_nojobTimer);
        _nojobTimer = null;
    }

    if (id == 'gnReady') {

        let url = `${HOST}/mercenary_guild.php`;
        tabWorker(url);
    }

    if (id == 'glReady') {

        let url = `${HOST}/leader_guild.php`;
        tabWorker(url);
    }

    CN.clear(id);
});

// Обработка событий нажатия на кнопки в нотификациях
CN.onButtonClicked.addListener(async (id, btnIdx) => {

    if (id == 'new_version') {
        const storage = await getStorage();
        if (btnIdx == 0) {
            CT.create({ 'url': `https://drive.google.com/uc?export=download&id=1OZUR0p_tQW2Dekv9mJm9EYxOCrFRrXSu` });
        } else {
            // добавляем текущий файл обновления в игнор
            setStorage({ update_ignore: storage.update_version });
        }
    }

    if (id == 'job') {
        if (btnIdx == 0) {
            let url = `${HOST}/object-info.php?id=${jobID}`;
            tabWorker(url);
        }
    }

    if (id == 'duelfound') {
        if (btnIdx == 0) {
            clearTimeout(_duelTimer);
            _duelTimer = null;

            let url = `${HOST}/accept_duel.php?id=${accept_duel}`;
            tabWorker(url);

        } else {
            clearTimeout(_duelTimer);
            _duelTimer = null;

            let url = `${HOST}/cancel_duel.php?action=retreat&id=${cancel_duel}`;
            tabWorker(url);
        }
    }

    CN.clear(id);
});

// Обработка событий закрытия нотификаций
CN.onClosed.addListener(id => {

    if (id == 'travelTimer') {
        travelShow = false;
    }

    if (id == 'nojob') {
        clearInterval(_nojobTimer);
        _nojobTimer = null;
    }

    if (id == 'restTimer') {
        restShow = false;
    }

    if (id == 'duelfound') {
        alertclicked = true;
    }
});



// МАСТЕР БИЛДОВ

const saveBuild = async name => {

    let build = [];

    // Сохраняем параметры фракции и класса
    let page = await loadPage(`${HOST}/pl_info.php?id=${userID}`);
    // Берём картинку класса-фракции и по числу определяем что записать в билд (1 - рыцари, 101 - рыцарь света и т.д.)
    let fract = /f\/r(\d+)/.exec(page)[1];

    // Сохраняем параметры навыков
    let reg = /showperkinfo.php\?name=(\w+)/g;
    let skills = parsePage(page, reg);

    // Сохраняем параметры армии
    page = await loadPage(`${HOST}/army.php`);
    reg = /nownumberd'] = (\d+)/g;
    let army = parsePage(page, reg);

    // Сохраняем очки умений
    // Сохраняем текущие очки, сбрасываем, вычитаем из прошлых очков новые, сохраняем разницу,
    // восстанавливаем очки умений

    page = await loadPage(HOST + HOME);
    let points_obj = null;

    if (/sign=/.exec(page)) {

        reg = /home_stat/.test(page) ? /p[adpk]">(\d+)/g : /(?:е|та|и|я):<\/t.+?(\d+)/g; // новый или старый дизайн страницы

        const points = parsePage(page, reg);

        page = await loadPage(HOST + '/shop.php?b=reset_tube&reset=2&sign=' + SIGN);

        const new_points = parsePage(page, reg);

        let att = points[0] - new_points[0];
        let def = points[1] - new_points[1];
        let power = points[2] - new_points[2];
        let knw = points[3] - new_points[3];

        points_obj = { "attack": att, "defence": def, "power": power, "knowledge": knw };

        await new Promise(resolve => proccessPoints(points_obj, resolve));
    }

    build.push(fract, skills, army, points_obj);
    buildSaved(name, build);
}


const loadBuild = async name => {

    const storage = await getStorage();

    let build = storage[userID + "_buildlist"][name];

    // Загружаем фракцию и класс
    await fetch(`${HOST}/castle.php?change_clr_to=${build[0]}&sign=${SIGN}`, REDIRECT);

    // Загружаем навыки
    // Если название навыка содержит цифру и она больше 1, 
    // то последовательно сохраняем аналогичные умения по номерам в стек
    let skills = build[1];
    let str = "";
    let i = 0;

    skills.forEach(skill => {
        let num = /(\d+)/.exec(skill);
        if (num) {
            if (num[1] > 1) {
                skill = /(\D+)/.exec(skill)[1];
                let j = 1;
                while (num[1]--) {
                    str += 'param' + i + '=' + skill + j + '&';
                    i++, j++;
                }
            } else {
                str += 'param' + i + '=' + skill + '&';
                i++;
            }
        } else {
            str += 'param' + i + '=' + skill + '&';
            i++;
        }
    });

    await fetch(`${HOST}/skillwheel.php`, {
        ...POST_PARAMS,
        body: str ? str : 'reset_all=1'
    });


    //Загружаем армию
    str = "";
    let amounts = build[2];

    amounts.forEach((amount, i) => {
        str += 'countv' + (i + 1) + '=' + amount + '&';
    });

    await fetch(`${HOST}/army_apply.php`, {
        ...POST_PARAMS,
        body: str
    });

    //Загружеаем очки умений
    if (build[3]) {
        await fetch(`${HOST}/shop.php?b=reset_tube&reset=2&sign=${SIGN}`, REDIRECT); // сброс
        await new Promise(resolve => proccessPoints(build[3], resolve));
    }
    buildLoaded(name);
}


const proccessPoints = (points, resolve) => {
    // Сортируем очки умений от меньших к большим и формируем стэк добавления очков
    const sorted = Object.keys(points).sort((a, b) => points[a] - points[b]);

    let stack = [];

    for (let j = 0; j < 3; j++) {
        if (points[sorted[j]] > 0) {
            let i = points[sorted[j]];
            while (i--) {
                stack.push(sorted[j]);
            }
        }
    }

    if (stack.length > 0) {
        increasePoints(stack, 0, sorted, resolve);
    } else {
        resolve(increaseAll(sorted[3]));
    }
}

const increaseAll = async link => {
    await fetch(`${HOST + HOME}?increase_all=${link}`, REDIRECT);
}

const increasePoints = async (stack, i, sorted, resolve) => {
    await fetch(`${HOST + HOME}?increase=${stack[i]}`, REDIRECT);
    if (i < stack.length - 1) {
        i++;
        increasePoints(stack, i, sorted, resolve);
    } else {
        resolve(increaseAll(sorted[3]));
    }
}

const buildLoaded = name => {
    setStorage({ busystate: null });
    CR.sendMessage({ 'popup': 'reload' }); //перезагрузка popup
    CT.sendMessage(tabID, { 'content': 'loc_reload' }); //перезагрузка content
    CN.create('build', {
        type: 'basic',
        iconUrl: ICON,
        title: 'Мастер билдов',
        message: `"${name}" успешно загружен!`,
        ...NOTIF_OPT
    });
}

const buildSaved = async (name, build) => {

    const storage = await getStorage();

    let obj = storage[userID + "_buildlist"];
    obj[name] = build;

    setStorage({ [userID + "_buildlist"]: obj, busystate: null });
    CR.sendMessage({ 'popup': 'reload' });
    CN.create('build', {
        type: 'basic',
        iconUrl: ICON,
        title: 'Мастер билдов',
        message: `"${name}" успешно сохранён!`,
        ...NOTIF_OPT
    });
}



// ГИЛЬДИЯ РАБОЧИХ

const grService = async DATA => {

    // если появился значок "Кирка" (новое меню) - останавливаем таймер, ищем работу
    if (/\/work.png/.test(DATA) && !testURL(/object-info/)) {
        showNews = false;
        grFirstCheck = false;
        if (_grTimer) {
            _grTimer.clear();
            _grTimer = null;
        }
    }

    // Проверка выполняется, если расширение стартует не с домашней страницы (первая установка и т.п.)
    if (!testURL(/home/) && grFirstCheck) {
        const page = await loadPage(HOST + HOME + '?info');
        return grHomeCheck(page);
    }

    if (testURL(/home/)) {
        // проверка на интерфейс с картой
        if (/area/.test(DATA) && grFirstCheck) {
            const page = await loadPage(HOST + HOME + '?info');
            return grHomeCheck(page);
        }
        grHomeCheck(DATA);
    }

    // поиск работы с любой страницы кроме особых случаев
    if (!testURL(/object-info|home/) && !_grTimer && !grFirstCheck) {
        if (showNews) return grMessage();
        getJob();
    }

    // Страница объекта
    if (testURL(/object-info/)) {
        if (/getjob|g-recaptcha/.test(DATA)) {
            if (_grTimer) {
                _grTimer.clear();
                _grTimer = null;
            }
            showNews = false;
            grMessage();
        } else if (!_grTimer) {
            // Ответ после устройства на работу
            // Проверяем, что таймер не запущен, на случай если игрок случайно обновит страницу после удачного устройства
            if (/устроены/.test(DATA)) {
                setStorage({ workcode: null, workdata: null });
                grTimer(60.9 * 60000); // Добавлено 0.9 минуты для корректировки
            } else {
                if (showNews) return grMessage();
                getJob();
            }
        }
    }
}


// Проверка домашней страницы
const grHomeCheck = DATA => {

    if (!TRAVEL.test(DATA)) grFirstCheck = false; // игрок не перемещается, данные по работе доступны
    showNews = /wide_news/.test(DATA); // новости на главной странице - информация о работе недоступна

    if (/нигде не работаете/.test(DATA)) {
        if (_grTimer) {
            _grTimer.clear();
            _grTimer = null;
        } // Если уже доступна работа, то чистим таймер и начинаем поиск
        return getJob();
    }
    if (/работу через/.test(DATA) && !_grTimer) {

        let m = +/работу через.(\d+)/.exec(DATA)[1] + 0.9; // Добавлено 0.9 минуты для корректировки

        return grTimer(m * 60000);
    }
    if (/с \d+:\d+/.test(DATA) && !_grTimer) {

        let t = /с (\d+):(\d+)/.exec(DATA);
        let h = +t[1];
        let m = +t[2];

        let t2 = /(\d+):(\d+)(?:,|<)/.exec(DATA); // время сервера
        let d1 = new Date(0, 0, 0, h + 1, m);
        let d2 = new Date(0, 0, 0, (h == 23 && t2[1] == 0) ? 24 : t2[1], t2[2]);
        let diff = new Date(d1 - d2).getTime();

        return grTimer(diff + 54000); // Добавлено 54 секунды для корректировки
    }

    // заглушка на случай перемещения либо вывода новостей на новой главной странице
    // или перехода на home во время перемещения
    grMessage();
}


const grTimer = time => {
    let endtime = new Date().getTime() + time;
    _grTimer = new Timer(endtime, grCallback, grOnstop);
    _grTimer.tick();
}

const getJob = async () => {

    grMessage();

    if (_travelTimer) return

    const storage = await getStorage();

    if (storage[userID + "_jobseek"]) {

        CN.clear('job');

        const safe = await safetyLoad();
        if (!safe) return

        let salary = 0, promises = [];
        jobID = 0; // глобальная переменная

        for (let section of SECTIONS) {

            promises.push(loadPage(`${HOST + MAP}?st=${section}`).then(page => {

                const xmlDoc = new DOMParser().parseFromString(page, "text/html");
                const trs = xmlDoc.querySelectorAll('tr[class^="map_obj_table_hover"]');

                for (let tr of trs) {

                    const obj_link = tr.lastChild.firstChild;

                    if (obj_link.innerHTML == '&nbsp;»»»&nbsp;') {
                        const current_id = /id=(\d+)/.exec(obj_link)[1];
                        const current_salary = tr.querySelector('b').textContent;

                        if (current_salary > salary) {
                            salary = current_salary;
                            jobID = current_id;
                        }
                    }
                }
            }));
        }

        await Promise.all(promises);

        // сообщаем, что нет работы
        if (jobID == 0 && !_nojobTimer) {
            let sec = 20, msg = 'В текущем районе вакансий нет!\nПроверим снова через ';
            CN.clear('job');

            CN.create('nojob', {
                type: 'basic',
                iconUrl: GRICON,
                title: _GR,
                message: msg + sec + ' сек.',
                ...NOTIF_OPT
            });

            const nojobTimer = () => {
                if (sec > 0) sec--;
                else {
                    clearInterval(_nojobTimer);
                    _nojobTimer = null;
                    getJob();
                    CN.clear('nojob');
                }

                CN.update('nojob', {
                    message: msg + sec + ' сек.',
                });
            }

            _nojobTimer = setInterval(nojobTimer, 1000);

        } else if (jobID != 0) {

            clearInterval(_nojobTimer);
            _nojobTimer = null;
            CN.clear('nojob');

            CN.create('job', {
                type: 'basic',
                iconUrl: GRICON,
                title: _GR,
                message: `Найдена вакансия! Устроиться на работу? Зарплата: ${salary}`,
                buttons: [{ 'title': `Да${storage.workcode ? ' (автокод)' : ''}` }, { 'title': 'Нет' }],
                requireInteraction: true,
                ...NOTIF_OPT
            });
        }
    }
}


const grMessage = () => !_grTimer && CT.sendMessage(tabID, { 'content': 'gtimers', 'grStatus': 'grReady' });


// ГИЛЬДИЯ ОХОТНИКОВ

const goService = async DATA => {

    if (testURL(MAP_REGEXP) && DATA) {

        const timers = [...DATA.matchAll(/MapHunterDelta = (\d+)/g)].flatMap(i => i[1]);

        if (!_goTimer && timers.length === 2) {
            // Если на странице карты счетчик охоты, запускаем таймер
            goChecked = true;
            goTimer(+timers[1]);
        }

        if (_goTimer && /army_info/.test(DATA)) {
            // Если таймер уже запущен и есть охоты, значит останавливаем его
            _goTimer.clear();
            _goTimer = null;
        }

        // Очищаем таймер отслеживания начала парной охоты, если так никто и не зашёл
        if (/ohota_block/.test(DATA) && _go_help_waiter) {
            clearInterval(_go_help_waiter);
            _go_help_waiter = null;
        }
    }

    // Очищаем таймер отслеживания начала парной охоты, если так никто и не зашёл
    if (testURL(/group_wars/) && _go_help_waiter && !/7" width="17%">Охотник/.test(DATA)) {
        clearInterval(_go_help_waiter);
        _go_help_waiter = null;
    }

    goMessenger();

    // Необходимость в "бросились бежать" обусловлена тем, что мы, после нажатия на кнопку "Напасть" на охоте, находимся
    // в состоянии !goChecked. Необходимо откладывать проверку списка охот до боя. Также дополнительно проверяется
    // "бросились бежать" и на случай нахождения игрока на других страницах. goChecked приходится ставить в true, только при выполнении условий.
    // Также это спасает от моментов, когда таймер заканчивается во время перемещения игрока по карте, но при этом он на странице форума.

    if (!goChecked && !/бросились бежать/.test(DATA)) {

        const safe = await safetyLoad();

        if (safe) {

            const page = await loadPage(HOST + MAP);
            const timers = [...page.matchAll(/MapHunterDelta = (\d+)/g)].flatMap(i => i[1]);

            if (TRAVEL.test(page)) { return } else goChecked = true;

            // Проверяем, не запущен ли уже таймер, на случай, если событие происходит после автобоя в ГН и
            // перемещения в другой сектор на страницу ГН (uncheck)
            if (timers.length === 2 && !_goTimer) goTimer(+timers[1]);

            else if (!/ohota_block|tykv/.test(page)) {
                // Если не отображается ни одна охота или нет значка Тыквика(Хэллоуин), значит игрок в режиме ожидания помощи в парной охоте
                goHelpWaiter();
                goMessenger();
            }
            // Если обнаружены охоты, выводим сообщение
            else if (/army_info/.test(page) && !/бросились бежать/.test(page)) {

                const storage = await getStorage();

                storage[userID + "_goAlert"] && CN.create('goReady', {
                    type: 'basic',
                    iconUrl: GOFACE,
                    title: _GO,
                    message: 'Доступны новые задания! >>',
                    requireInteraction: true,
                    ...NOTIF_OPT
                });
            }
        }
    }
}

const goMessenger = () => !_goTimer && CT.sendMessage(tabID, { 'content': 'gtimers', 'goStatus': _go_help_waiter ? 'waiting' : 'goReady' });

const goTimer = time => {
    let endtime = new Date().getTime() + (time + 1) * 1000; // Добавлена 1 секунда для корректировки
    _goTimer = new Timer(endtime, goCallback, goOnstop);
    _goTimer.tick();
}

const goHelpWaiter = () => {
    _go_help_waiter = setInterval(async () => {

        const status = await getStatus();

        if (status == 'inwar') {

            goChecked = false;
            clearInterval(_go_help_waiter);
            _go_help_waiter = null;

        } else if (status == 'otherfree') {

            clearInterval(_go_help_waiter);
            _go_help_waiter = null;
            goMessenger();
        }
    }, 30000);
}


// ГИЛЬДИЯ НАЁМНИКОВ

const gnService = async DATA => {

    if (testURL(/mercenary_guild/)) {

        if (/Приходи через (\d+)/.test(DATA) && !_gnTimer) {
            gnChecked = true;
            gn_task = false;
            gnTimer(+RegExp.$1);
        }

        if (_gnTimer && /global_input|Для Вас есть задание/.test(DATA)) {
            gnChecked = true;
            _gnTimer.clear();
            _gnTimer = null;
        }

        // В процессе выполнения задания
        if (/золота<p><\/p><hr/.test(DATA)) {
            gnChecked = true;
            gn_task = true;
        }
    }

    if (testURL(MAP_REGEXP) && /accept_merc/.test(DATA)) {
        gnChecked = true;
        gn_task = true;
    }


    gnMessenger();

    if (!gnChecked && pl_lvl >= 5) {

        const safe = await safetyLoad();

        if (safe) {

            const page = await loadPage(`${HOST}/mercenary_guild.php`);

            if (TRAVEL.test(page)) { return } else gnChecked = true;

            if (/global_input|Для Вас есть задание|Вы еще не приняли|в заявке/.test(page)) {
                // Если доступны задания и игрок в районе ГН или не в районе ГН, но задание есть,
                // или задание было просмотрено игроком, но не принято.
                gnAlert('Доступны новые задания!');
            } else if (/осталось (.+) <\/f/i.test(page)) {
                // Если в процессе выполнения задания, показываем оставшееся время.
                gn_task = true;
                gnAlert(`Вы на задании! Осталось ${RegExp.$1}`);
                gnMessenger();
            } else if (/Приходи через (\d+)/.test(page)) {
                // Если в секторе ГН, но время еще не вышло.
                gnTimer(+RegExp.$1);
            } else {
                // Если не в секторе ГН
                gnAlert('Вы находитесь в другом районе');
            }
        }
    }
}

const gnMessenger = () => !_gnTimer && CT.sendMessage(tabID, { 'content': 'gtimers', 'gnStatus': gn_task ? 'task' : 'gnReady' });

const gnTimer = time => {
    let endtime = new Date().getTime() + (time + 1) * 60000; // Добавлена 1 минута для корректировки
    _gnTimer = new Timer(endtime, gnCallback, gnOnstop);
    _gnTimer.tick();
}

const gnAlert = async mes => {

    const storage = await getStorage();

    if (storage[userID + "_gnAlert"]) CN.create('gnReady', {
        type: 'basic',
        iconUrl: GNFACE,
        title: _GN,
        message: mes + ' >>',
        requireInteraction: true,
        ...NOTIF_OPT
    });
}


// ГИЛЬДИЯ ВОРОВ

/* Логика:
1. При старте во время анализа страницы игрока происходит проверка на открытость ГВ. Если открыта (thief_on=true), то:
2. Происходит проверка лога битв на предмет проигранной битвы ГВ: если битва есть и прошедшее время после нее менее 61 минуты,
то запускаем таймер. В обратном случае выводим уведомление - можно установить засаду ГВ;
3. При установке засады, запускается проверочный таймер с интервалом 30 секунд, проверяющий начался ли бой ГВ. 
Как только он начнётся gvChecked становится false - после боя произойдет перепроверка лога битв. Если бой проигран - запускается таймер,
если нет - выводится уведомление о доступности засады ГВ;
*/


const gvService = async DATA => {


    if (testURL(MAP_REGEXP)) {
        // Отключаем таймер, если ГВ стала доступна на карте раньше
        if (/Воров<\/b/.test(DATA) && _gvTimer) {
            _gvTimer.clear();
            _gvTimer = null;
        }

        // Ожидаем начало боя ГВ
        if (/ambush_cancel/.test(DATA) && !_gv_battle_waiter) await gvBattleWaiter();

        // Отменяем ожидание начала боя ГВ
        if (!/Воров<\/b/.test(DATA) && _gv_battle_waiter) {

            clearInterval(_gv_battle_waiter);
            _gv_battle_waiter = null;
        }
    }

    if (thief_on && !gvChecked) {

        const storage = await getStorage();
        const safe = await safetyLoad();

        if (safe) {

            gvChecked = true;

            if (!storage.gv_boost) {

                let boost = (storage.abubekr ? 0.7 : 1) * (1 - storage.gv_koef / 100) * (storage.gv_pryanik ? 0.2 : 1); // Ускорение таймера за счёт Абу-Бекра, дополнительного коэффициента и пряника\плюшки
                let thief_time = 60 * boost | 0; // Минуты

                const page = await loadPage(`${HOST}/pl_warlog.php?id=${userID}`);
                // время окончания последней проигранной битвы ГВ (либо каравану, либо рейнджеру)
                let t = /(\d+)-(\d+)-(\d+) (\d+):(\d+)(?:<\/a>: • <a|.+i><b>Рейнджер)/.exec(page);

                if (t) {

                    let serv_time = await loadPage(`${HOST}/time.php`);

                    let t2 = /(\d+)-(\d+)-(\d+) (\d+):(\d+)/.exec(serv_time); // время сервера
                    let d1 = new Date(20 + t[3], t[2], t[1], t[4], +t[5] + thief_time);
                    let d2 = new Date(20 + t2[3], t2[2], t2[1], t2[4], t2[5]);
                    let diff = new Date(d1 - d2).getTime();

                    // Если время ожидания меньше 60 минут, то запускаем таймер
                    if (diff > 0 && diff / 60000 < 61) {

                        let endtime = new Date().getTime() + diff + 35000; // 35 секунд для корректировки
                        _gvTimer = new Timer(endtime, gvCallback, gvOnstop);
                        _gvTimer.tick();
                    }
                }
            }

            !_gvTimer && !_gv_battle_waiter && storage[userID + "_gvAlert"] && CN.create('gvReady', {
                type: 'basic',
                iconUrl: GVFACE,
                title: _GV,
                message: 'Вы можете устроить засаду >>',
                requireInteraction: true,
                ...NOTIF_OPT
            });
        }
    }

    !_gvTimer && CT.sendMessage(tabID, { 'content': 'gtimers', 'gvStatus': _gv_battle_waiter ? 'ambush' : 'gvReady' });
}

const gvBattleWaiter = async () => {
    const storage = await getStorage();
    _gv_battle_waiter = setInterval(async () => {
        const status = await getStatus();
        if (status == 'inwar') {
            gvChecked = false;
            clearInterval(_gv_battle_waiter);
            _gv_battle_waiter = null;
        }
    }, storage.gv_boost ? 5000 : 25000);
}


// ГИЛЬДИЯ ЛИДЕРОВ

const glService = async DATA => {

    if (testURL(/leader_guild/) && /заданий: 0/.test(DATA) && !_glTimer) {
        let t = +/Delta2 = (\d+)/.exec(DATA)[1];
        glChecked = true;
        glTimer(t);
    }

    !_glTimer && CT.sendMessage(tabID, { 'content': 'gtimers', 'glStatus': 'glReady' });

    if (!glChecked && pl_lvl >= 5) {

        const safe = await safetyLoad();

        if (safe) {

            const page = await loadPage(`${HOST}/leader_guild.php`);

            if (TRAVEL.test(page)) { return } else glChecked = true;

            if (/заданий: 0/.test(page)) glTimer(+/Delta2 = (\d+)/.exec(page)[1]);
            else {

                let tasks = /заданий: (\d)/.exec(page)[1];
                let txt = tasks == '1' ? 'задание!' : `${tasks} задания!`;

                const storage = await getStorage();

                storage[userID + "_glAlert"] && CN.create('glReady', {
                    type: 'basic',
                    iconUrl: GLFACE,
                    title: _GL,
                    message: `Для Вас есть ${txt} >>`,
                    requireInteraction: true,
                    ...NOTIF_OPT
                });
            }
        }
    }
}

const glTimer = time => {
    let endtime = new Date().getTime() + (time + 1) * 1000; // Добавлена 1 секунда для корректировки
    _glTimer = new Timer(endtime, glCallback, glOnstop);
    _glTimer.tick();
}