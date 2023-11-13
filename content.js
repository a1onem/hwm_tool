console.log('HWM Tool running');
// Object.keys(arts[n]) - для проверки порядкового номера параметра через консоль в Инвентаре

const _HP = ' ед. жизни';
const _LOADING = '<div style="color:#999">[...загрузка...]</div>';
const _RENTSHOP = 'Магазин аренды';
const _WAREHOUSE = 'Склад';
const DATA = document.documentElement.innerHTML;
const MAP = /map.php/;
const ID = /pl_hunter_stat.php\?id=(\d+)/.exec(DATA);
const NEWSTYLE = /topline_scripts/.test(DATA);
const TRAVEL = /"map_star/.test(DATA);
const IMG_LINK = /lordswm/.test(location.origin) ? 'https://cfcdn.lordswm.com/i/' : 'https://dcdn.heroeswm.ru/i/';

let MAX_LOTS = 25;

const putImg = img => `<img src=${chrome.extension.getURL(`img/${img}.png`)}>`;
const HORSE = ` ${putImg("horse")}`;
const INV_BTNS = `<div class="btn_srch inv_item_select_img" title="Найти на рынке">${putImg("inv_search")}</div><div class="btn_sell inv_item_select_img" title="Выставить на продажу">${putImg("inv_sell")}</div>`;

const MARKET_FILTERS = '&sort=204&sbn=0&sau=0&snew=0';

const ELEMENTS = { abrasive: 'Абразив', snake_poison: 'Змеиный яд', tiger_tusk: 'Клык тигра', ice_crystal: 'Ледяной кристалл', moon_stone: 'Лунный камень', fire_crystal: 'Огненный кристалл', meteorit: 'Осколок метеорита', witch_flower: 'Цветок ведьм', wind_flower: 'Цветок ветров', fern_flower: 'Цветок папоротника', badgrib: 'Ядовитый гриб' }
const SPECIAL_ART = RegExp(`potion|thief_paper|part_|sec_|dom_|sha_|${Object.keys(ELEMENTS).join('|')}|\\b[1-6]\\b`); // арты без прочности
const SPECIAL_CAT = /res|elements|dom|part|cert|obj_share/;
const RESOURCES = ['wood', 'ore', 'mercury', 'sulfur', 'crystals', 'gems'];
const RES_NAMES = ['Древесина', 'Руда', 'Ртуть', 'Сера', 'Кристаллы', 'Самоцветы'];

const CRSM = chrome.runtime.sendMessage;
const CROM = chrome.runtime.onMessage;
const CSL = chrome.storage.local;

let base, firstload = true;
let gtblock, grtime, gotime, gntime, gltime, gvtime;
let userID;

// Теневая загрузка страниц
const loadPage = async url => {
    const page = await fetch(url);
    const decodedPage = await pageDecoder(page);
    return decodedPage;
}

const pageDecoder = async page => {
    const buffer = await page.arrayBuffer();
    const dataView = new DataView(buffer);
    const decoded = new TextDecoder('windows-1251').decode(dataView);
    return decoded;
}

// Парсинг страниц
// gr2 = true - использовать группу 2 regex 
// на выходе получаем Array [group1..., group2...]

const parsePage = (page, reg, gr2 = false) => [...page.matchAll(reg)].flatMap(i => gr2 ? [i[1], i[2]] : i[1]); // продвинутый вариант

const testURL = reg => reg.test(location.href);

// Вспомогательные функции (для эффективного сжатия кода)
const addListener = (elem, action, callback) => elem.addEventListener(action, callback);
const qSelect = (query, elem = document) => elem.querySelector(query);
const qSelectAll = (query, elem = document) => elem.querySelectorAll(query);
// Запись значений в storage.local
const setStorage = obj => CSL.set(obj);
// Получаем объект storage.local
const getStorage = () => new Promise(resolve => CSL.get(null, storage => resolve(storage)));

// Заблокированные аккаунты
const BLOCKLIST = ['3691889'];

/* Отслеживание входа в игру.
Если на странице <!-- Login-->, то значит незалогинен - вызываем функцию в бэкграунде.
Если игрок на странице боя - отправляем в бэкграунд location.href.
Если страница не содержит ссылку на регистрацию (reg.php) и содержит ID, загружаем базу и запускаем Run() - игрок авторизован и в игре.
*/
if (/<!-- Login-->/.test(DATA)) {

    CRSM({ 'logout': true });
    sessionStorage.clear();

} else if (testURL(/(?:war|cgame|quest_s.+)\.php/)) {

    CRSM({ 'inWar': location.href });

    CROM.addListener((request, sender, response) => {

        if (request.content == 'loc_replace') {
            response(true);
            location = request.url;
        }
    });

    // обработка событий бота ГН в бою
    if (testURL(/war.php/) && /warlog\|0/.test(DATA)) {
        CSL.get(null, storage => CRSM({ 'get_base': true }, response => {
            base = response.base;
            storage[storage.userID + "_gnBot"] && gnBotBattle(storage);
        }));
    }

} else if (!/reg.php/.test(DATA) && ID) { // игрок залогинен и в игре

    userID = ID[1];

    CSL.get(null, storage => CRSM({ 'get_base': true }, response => {
        base = response.base;
        // Проверяем не находится ли ID в списке блокировок
        !storage.blocked && (BLOCKLIST.includes(userID) ? (CSL.clear(), setStorage({ blocked: true })) : Run(storage));
    }));
}


const Run = storage => {

    // Отправляем userID, urlPATH и DATA в background
    CRSM({ userID, 'urlPATH': location.pathname, DATA });

    if (!([userID + "_key"] in storage)) {
        // присваиваем дефолтные настройки новому игроку
        let obj = {}
        for (let key in storage) {
            if (/default_(.+)/.test(key)) {
                obj[userID + "_" + RegExp.$1] = storage[key];
            }
        }

        setStorage(obj);
        storage = { ...storage, ...obj };
    }

    // Если происходит авторизация, приветствуем игрока единожды и меняем статус login
    if (storage.login) {
        // Если уже залогинен и в игре, то проверяем таймеры гильдий
        CRSM({ 'gtimers': true });

        // первая проверка рынка идет через логин, дальше - тут
        // необходимо, чтобы успел провериться ключ активации
        storage[userID + "_tradehelp"] && CRSM({ 'tradehelp': true });

    } else {
        setStorage({ userID }); // сохраняем настройки
        CRSM({ 'login': true });
    }

    // скрытие пунктов\кнопок меню
    hideMenu(storage);


    // получаем значения здоровья и таймера
    let health, health_t;

    if (NEWSTYLE) {
        const hdata = /_heart\((\d+).+?(\d+)\)/.exec(DATA);
        health = +hdata[1];
        health_t = +hdata[2];
    } else {
        health = +/heart=(\d+)/.exec(DATA)[1]; //получаем значение heart (0-100)
        health_t = +/time_heart=(\d+)/.exec(DATA)[1]; //получаем значение time_heart (900 секунд)
    }


    // Подготовка панели таймеров
    if (storage[userID + "_gtimers"]) {

        let html = '<div id="gtblock"><b>ГР</b> <span id="grtime"></span> <a title="Перейти в Гильдию Охотников" href="/hunter_guild.php"><b>ГО</b> '
            + '<span id="gotime"></span></a> <a title="Перейти в Гильдию Наёмников" href="/mercenary_guild.php"><b>ГН</b> '
            + '<span id="gntime"></span></a> <a title="Перейти в Гильдию Лидеров" href="/leader_guild.php"><b>ГЛ</b> '
            + '<span id="gltime"></span></a> <a title="Перейти в Гильдию Воров" href="/thief_guild.php"><b>ГВ</b> <span id="gvtime"></span></a></div>';

        document.body.insertAdjacentHTML('beforeend', html);

        gtblock = qSelect('#gtblock');

        gtblock.style.display = 'none';

        grtime = qSelect('#grtime');
        gotime = qSelect('#gotime');
        gntime = qSelect('#gntime');
        gltime = qSelect('#gltime');
        gvtime = qSelect('#gvtime');
    }


    // Таймер перемещения
    if (testURL(MAP)) {

        const sector = getCurrentSector(DATA);

        if (TRAVEL) {

            // отправляем значение таймера
            const time = +/Delta=(\d+)/.exec(DATA)[1];
            CRSM({ 'travel_time': time });

            setStorage({ sector });

        } else {
            // Чистим ключи перемещений, если игрок находится в заявке или нет транспорта (переход на карту после нажатия ссылки быстрого перемещения)
            setStorage({ trackto: null, sector });
        }
    }


    // Отслеживание значение здоровья
    if (storage[userID + "_htimer"]) {
        // Отправляем значение здоровья и времени востановления в background
        CRSM({ 'restoration_h': health, 'restoration_t': health_t });
    } else {
        CRSM({ 'del_resttimer': true });
    }


    // Прослушивание событий
    CROM.addListener((request, sender, response) => {

        if (request.content == 'loc_reload') location.reload();

        if (request.content == 'loc_replace') {
            // необходимо для работы с фреймами - чат
            response(true);
            location = request.url;  // меняем url окна
        }

        if (request.content == 'loc_replace_extSort') {
            const link = location.href;
            if (/auction.+sort/.test(link)) injectSortToLink(link, request.sort);
            else location.reload();
        }



        // Таймеры
        if (storage[userID + "_gtimers"] && request.content == 'gtimers') {

            if (request.guild == 'gr') {
                grtime.textContent = request.timer[0] + ':' + request.timer[1];
            } else if (request.grStatus == 'grReady') {
                grtime.innerHTML = '<i>--:--</i>';
            }

            if (request.guild == 'go') {
                gotime.textContent = request.timer[0] + ':' + request.timer[1];
            } else if (request.goStatus == 'goReady') {
                gotime.innerHTML = '<i>--:--</i>';
            } else if (request.goStatus == 'waiting') {
                gotime.innerHTML = '<i style="color:orange">(ожидание помощи)</i>';
            }

            if (request.guild == 'gn') {
                gntime.textContent = request.timer[0] + ':' + request.timer[1];
            } else if (request.gnStatus == 'gnReady') {
                gntime.innerHTML = '<i>--:--</i>';
            } else if (request.gnStatus == 'task') {
                gntime.innerHTML = '<i style="color:orange">(на задании)</i>';
            }

            if (request.guild == 'gv') {
                gvtime.textContent = request.timer[0] + ':' + request.timer[1];
            } else if (request.gvStatus == 'gvReady') {
                gvtime.innerHTML = '<i>--:--</i>';
            } else if (request.gvStatus == 'ambush') {
                gvtime.innerHTML = '<i style="color:orange">(в засаде)</i>';
            }

            if (request.guild == 'gl') {
                gltime.textContent = request.timer[0] + ':' + request.timer[1];
            } else if (request.glStatus == 'glReady') {
                gltime.innerHTML = '<i>--:--</i>';
            }

            if (firstload && grtime.innerHTML && gotime.innerHTML && gntime.innerHTML && gltime.innerHTML && gvtime.innerHTML) {
                firstload = false;
                gtblock.style.display = 'block';
                gtblock.className = 'gtblock ' + storage[userID + "_gtpos"] + ' ' + storage[userID + "_gtstyle"];
            }
        }
    });


    // если игрок перемещается, дальнейший код не выполняем
    if (TRAVEL) return


    // Обработка страниц гильдий
    goGUIService(); // ГО
    gnGUIService(); // ГН
    glGUIService(); // ГЛ
    gvGUIService(storage); // ГВ
    storage[userID + "_gnBot"] && gnBot(); // ГН


    // Ссылки быстрого перемещения в сектор и на объект
    storage[userID + "_fasttravel"] && showFasttravel(storage);


    // Информатор
    storage[userID + "_informator"] && Informator(storage);


    /* Автопоиск работы*/
    if (storage[userID + "_jobseek"] && testURL(/object-info/) && /getjob/.test(DATA)) {

        const btn = qSelect('input[src*="btn_work"]');
        const input = qSelect('#code');

        // Быстрое устройство на работу без кода
        if (!input) {
            btn.click();
            return;
        }

        const script = document.createElement('script');

        // Если есть сохранённый код и не ошибка неправильного кода, вставляем его и жмём на кнопку.
        if (storage.workcode && !testURL(/error_id=15/)) {

            // внедряем скрипт для обхода защиты от ботов
            script.textContent += `work_was_focused=true;work_code_data=${storage.workdata}`; // внедряем сохранённые данные
            document.body.append(script);

            input.value = storage.workcode;
            btn.click();

        } else {

            // Если кода нет, то записываем его при нажатии на кнопку.
            addListener(btn, 'click', e => {
                // берем данные движения мыши и прочее, вставляем их скрыто на страницу, чтобы сохранить в дальнейшем при клике на кнопку
                script.textContent = 'document.body.insertAdjacentHTML("beforeend",`<span style=display:none>${JSON.stringify(work_code_data)}`)';
                document.body.append(script);

                const workdata = qSelect('span[style*="none"]').textContent;
                setStorage({ workcode: input.value, workdata });
            });

            setStorage({ workcode: null, workdata: null });
        }
    }




    // Отслеживание создания заявки на бой (проверяем только при полном здоровье)
    if (storage[userID + "_battlealert"] && health == 100) {
        // групповые, охота, ГРж, ГТ, Быстрый и Парный турниры, МТ++, бои за территории, Охота на Пиратов, Великое состязание
        if (testURL(/group_wars|ranger_list|pvp_guild|tournaments\.|mapwars|pirate_hunt\.|team_event/)) CRSM({ 'battlealert': true });

        // ГВ
        if (testURL(MAP) && /ambush_cancel/.test(DATA)) {
            CRSM({ 'battlealert': true });

            let link = qSelect('[href*="ambush_cancel"]');
            addListener(link, 'click', () => {
                CRSM({ 'ambushcancel': true });
            });
        }

        // Дуэли
        if (testURL(/one_to_one/)) {
            CRSM({ 'duelalert': true });

            if (/cancel_duel/.test(DATA)) {
                let link = qSelect('[href*="cancel_duel.php?id"]');
                addListener(link, 'click', () => {
                    CRSM({ 'duelcancel': true });
                });
            }
        }
    }

    // Рынок - Остлеживание лотов
    storage[userID + "_tradehelp"] ? tradeHelperGUI(storage) : CRSM({ 'tradehelp_off': true });

    // Выставление арта на продажу
    testURL(/new_lot/) && newLot(storage);


    // Парсер протокола передач
    storage[userID + "_protocol"] && testURL(/pl_transfers/) && protocolParser();


    // Дружественные передачи
    testURL(/transfer.php|(?:mart8|feb23|vd)_send/) && friendlyTransfer();


    // Ссылки в профилях персонажей на передачу ресурсов и элементов
    if (testURL(RegExp(`pl_info\\..+=(?!${userID})`))) profileLinks(storage);


    // Работа с инвентарём
    testURL(/inventory/) && inventoryUtils(storage);
}


// определяем сектор пребывания игрока
const getCurrentSector = page => {
    const secId = /(?:"|\*)(\d+):/.exec(page)[1];
    return Object.keys(base.sectors).find(key => base.sectors[key] == secId);
}


/* Контроль за отображением разделов */

const hideMenu = storage => {

    let buttons = qSelectAll(NEWSTYLE ? '[class*="mm_item "]' : '[style*="t_bkg"]>tbody>tr>td');

    const butIds = [];
    //Убираем раздел Чат
    if (!storage[userID + "_chat"]) {

        NEWSTYLE ? butIds.push(7) : butIds.push(14, 13);

        if (TRAVEL) {
            const sel = qSelect('[class*="map_moving"]>[href*="frames"]');
            sel.href = 'help.php';
            sel.textContent = 'справка об игре';
        }
    }
    //Убираем раздел Рулетка
    if (!storage[userID + "_rulette"]) {

        NEWSTYLE ? butIds.push(4) : butIds.push(8, 7);

        if (TRAVEL) {
            const sel = qSelect('[class*="map_moving"]>[href*="roul"]');
            sel.href = `pl_info.php?id=${userID}`;
            sel.textContent = 'персонаж';
        }
        qSelect('[href*="room=3"]').remove();
    }
    //Убираем раздел Таверна
    if (!storage[userID + "_tavern"]) {

        NEWSTYLE ? butIds.push(3) : butIds.push(6, 5);
        qSelect('[href*="room=4"]').remove();
    }

    // возвращаем видимость панели с кнопками
    if (butIds.length > 0) {
        for (const id of butIds) buttons[id].remove();
        if (NEWSTYLE) {
            for (const button of buttons) button.style.opacity = 1;
        } else {
            qSelect('[style*="t_bkg"] > tbody').style.opacity = 1;
        }

        if (TRAVEL) qSelect('[class*="map_moving"]').style.opacity = 1;
    }
}


// Ссылки быстрого перемещения

const showFasttravel = storage => {

    const cur_sector = storage.sector;

    // Перемещение к охотнику со страницы Групповых боёв

    if (testURL(/group_wars/)) {

        // Формируем список секторов
        const sectors = qSelectAll('[href*="cx="]');

        if (sectors.length > 0) {

            sectors.forEach(sector => {
                addListener(sector, 'click', () => {
                    setStorage({ trackto: 'hunter' });
                });

                const hunt_sector = sector.innerHTML;

                if (hunt_sector != cur_sector) {
                    sector.href = 'move_sector.php?id=' + base.sectors[hunt_sector];
                    sector.setAttribute('title', 'Отправиться в ' + hunt_sector);
                    sector.innerHTML += HORSE;
                } else {
                    sector.removeAttribute('href');
                    sector.innerHTML = '⤞' + hunt_sector + '⤝';
                }
            });
        }
    }


    // Перемещение на объект со страницы объекта

    if (testURL(/object-info/)) {

        const obj_sector = /\d">([\w' ]+)/i.exec(DATA)[1]; // сектор объекта

        if (obj_sector != cur_sector) {

            const sel = qSelect('td > [href*="cx="]');

            sel.href = `move_sector.php?id=${base.sectors[obj_sector]}`;
            sel.setAttribute('title', 'Отправиться на объект');
            sel.innerHTML += HORSE;

            const objid = /id=(\d+)/.exec(location.href)[1];

            addListener(sel, 'click', () => {
                setStorage({ trackto: 'object', objid });
            });

        }
    }


    // Перемещение на объект со страницы статистики

    if (testURL(/ecostat_details.php\?(?:id|r)=(?!(?:1|2|3|4|5|6|8|9|10|11|55|77|80|81)$)/)) { // отсеиваем объекты, производящие ресурсы и материалы

        // Формируем список секторов
        const objs_tr = qSelectAll('#tableDiv>table>tbody>tr');

        for (let obj of objs_tr) {

            const objid = /id=(\d+)/.exec(obj.innerHTML)[1];
            const sector = qSelect('[href*="cx="]', obj);

            addListener(sector, 'click', () => {
                setStorage({ trackto: 'object', objid });
            });

            const obj_sector = sector.innerHTML;

            if (obj_sector != cur_sector) {
                sector.href = 'move_sector.php?id=' + base.sectors[obj_sector];
                sector.setAttribute('title', 'Отправиться на объект');
                sector.innerHTML += HORSE;
            } else {
                sector.innerHTML = `<a href='object-info.php?id=${objid}'><b>Зайти на объект</b></a>`;
            }
        }
    }


    // Перемещение к игроку с профиля игрока

    if (testURL(RegExp(`pl_info\\..+=(?!${userID})`)) && !/unk_kukla/.test(DATA)) {
        const sel = qSelect('td > [href*="cx="]');
        const sector = sel.textContent;
        if (sector == cur_sector || sector == 'East Island') return;

        sel.href = 'move_sector.php?id=' + base.sectors[sector];
        sel.setAttribute('title', 'Отправиться к игроку');
        sel.innerHTML += HORSE;

        addListener(sel, 'click', () => {
            setStorage({ trackto: 'player' });
        });
    }
}



// Информатор

const Informator = storage => {

    const INFCOLOR = `<span class="informator" style="color:${storage[userID + "_color"]}">`;

    /* Подсчет ОА и количества надетых артов игроков в списке боёв */
    if (testURL(/group_wars|one_to_one/)) {
        let mouseY, wh = window.innerHeight;
        document.onmousemove = (e) => mouseY = e.clientY;

        const table = qSelect(`${testURL(/group/) ? 'table.wb' : 'table[width="100%"][cellpadding="3"]'}`);
        const ids = parsePage(table.innerHTML, /pl_info.php\?id=(\d+)/g); //получаем id всех игроков на странице

        for (let i = 0; i < ids.length; ++i) {

            loadPage(`pl_info.php?id=${ids[i]}`).then(async page => {

                let hidden = craft = runaway = false, points = 0, b_line = '';

                if (/unk_kukla/.test(page)) hidden = true; // аммуниция скрыта
                if (/mods_/.test(page)) craft = true; // надет крафт

                // Ищем бонусы
                let bonuses = parsePage(page, /i>(\W+)(?::|до) /g);

                bonuses.forEach(bonus => {

                    if (/сладость/.test(bonus)) b_line += putImg("inf_ny-sweet"), points += 4; // новогодняя сладость
                    if (/угощение/.test(bonus)) b_line += putImg("inf_ny-treat"), points += 4; // новогоднее угощение
                    if (/шоколад/.test(bonus)) b_line += putImg("inf_ny-chocolate"), points += 4; // новогодний шоколад
                    if (/пончик/.test(bonus)) b_line += putImg("inf_ny-donut"), points += 4; // новогодний пончик
                    if (/мороженое/.test(bonus)) b_line += putImg("inf_ny-icecream"), points += 4; // новогоднее мороженое
                    if (/Конфетка/.test(bonus)) b_line += putImg("inf_candy"), points += 2; // конфетки

                    if (/Капитанский|Выдержанный/.test(bonus)) b_line += putImg("inf_rum"), points += 4; // капитанский и выдержанный ром
                    if (/Пиратский/.test(bonus)) b_line += putImg("inf_rum"), points += 5; // пиратский ром
                    if (/Эль$/.test(bonus)) b_line += putImg("inf_ale"), points++; // новогодний или обычный эль

                    if (/Эликсир/.test(bonus)) b_line += putImg("inf_elixir"), points += 5; // эликсиры (устойчивости, силы и пр.)
                    if (/#/.test(bonus)) b_line += putImg("inf_potion"), points++; // зелья (силы, знаний и пр.)
                    if (/Зелье/.test(bonus)) b_line += putImg("inf_potion"); // зелья фракций
                    if (/Эффект/.test(bonus)) b_line += putImg("inf_tavern_potion"); // знапиток таверны

                    if (/Побег/.test(bonus)) runaway = true; // побег с поля
                });

                // Ищем арты
                let reg = /="art_info.php\?id=([\w\-&;=]+)/g;
                let items = parsePage(page, reg); //получаем массив артов


                // Анилиз полученных артов игрока и подсчет ОА
                for (let item of items) {

                    let lvl = /\[(\d+)\]/.exec(page)[1]; // определяем уровень героя

                    if (/cold_sword2014|sun_staff|sun_helm|sun_armor|sun_boots|clover_amul|wind_boots|wind_helm|16amul/.test(item)) points += lvl / 2 | 0; // Меч холода, Посох солнца, Шлем солнца, Доспех солнца, Сапоги солнца, Клевер фортуны, Сапоги ветра, Шлем ветра, Амулет баланса (+1 ОА за каждый второй уровень героя)
                    if (/lbow/.test(item)) points += lvl / 3 | 0; // Лук света (+1 ОА за каждый третий уровень героя)
                    if (/coldring_n|cold_shieldn|coldamul|super_dagger|sun_ring/.test(item)) points += lvl / 4 | 0; // Кольцо холода, Щит холода, Амулет холода, Кинжал пламени, Кольцо солнца (+1 ОА за каждый четвёртый уровень героя)

                    let craft_stat = null;


                    if (/&/.test(item)) {
                        // Если ссылка на арт содержит дополнительные параметры, ищем в названии арта признаки крафта [...]
                        const reg = RegExp(`${item}.+? \\[*([A-Z0-9]*)\\]* ?<`);
                        craft_stat = reg.exec(page)[1];
                        // Отсекаем от ссылки лишнюю часть, оставив лишь название арта 
                        item = /(.+?)&/.exec(item)[1];
                    }

                    // вычисляем очки амуниции
                    let oa;
                    if (base.arts[item]) {
                        oa = base.arts[item][3];
                    } else {
                        // если арт не добавлен в базу
                        const page = await loadPage(`art_info.php?id=${item}`);
                        oa = +/амуниции:.+?(\d+)/.exec(page)[1];
                    }

                    // Если крафт
                    if (craft_stat) {
                        let d = craft_stat.match(/\d+/g);// находим проценты крафта
                        let cr_sum = d.reduce((a, b) => +a + +b); // суммируем их
                        oa += Math.floor(oa * (cr_sum / 100) * 2); //подсчет влияния крафта на оа 
                    }

                    points += oa;
                }

                const sel = qSelect(`[href*="${ids[i]}"]`, table);// находим ссылку игрока
                sel.className = 'plink';
                sel.setAttribute('target', '_blank');
                sel.removeAttribute('style');

                let text;

                if (hidden) {
                    text = 'скрыто';
                } else {
                    let xmlDoc = new DOMParser().parseFromString(page, "text/html");
                    let xtables = qSelect('td[width="74"]', xmlDoc).closest('tr');
                    qSelect('td[valign="top"] > table > tbody > tr', xtables).remove();

                    addListener(sel, 'mouseover', e => {
                        let div = document.createElement('div');
                        div.className = 'exInfo';
                        div.innerHTML = `<table width="830px" class="wblight"><tbody>${xtables.innerHTML}</tbody></table>`;
                        document.body.append(div);
                        if (mouseY > wh - div.clientHeight - 50) {
                            div.style.top = mouseY - 30 - div.clientHeight;
                        } else {
                            div.style.top = mouseY + 30;
                        }
                    });
                    addListener(sel, 'mouseout', e => qSelect('.exInfo').remove());

                    let _arts = 'артов', ilen = items.length;
                    if (ilen == 1) _arts = 'арт';
                    if (ilen > 1 && ilen < 5) _arts = 'арта';
                    text = `${points} оа, ${ilen} ${_arts}${(craft ? ` + ${putImg("inf_craft")}` : '')}${(b_line ? ` + ${b_line}` : '')}${(runaway ? ` + ${putImg("inf_runaway")}` : '')}`;
                }
                sel.innerHTML += ` ${INFCOLOR}(${text}) </span>`;// дописываем контент ссылки
            });
        }

        // Формируем список [мобы, количество....]

        const mobs = qSelectAll('i > font[color="black"]');

        if (mobs.length > 0) {

            for (let mob of mobs) {
                const data = /(.+) \((\d+)/.exec(mob.textContent);

                const name = data[1];
                const count = data[2];

                const inbase = base.mobs[name];
                if (!inbase) continue;

                const points = inbase[0] * count;

                mob.lastChild.remove();
                mob.insertAdjacentHTML('beforeend', `${INFCOLOR} (${count} / ${points + _HP})</span>`);
            }
        }
    }

    /* Подсчет общего количества единиц жизни нейтралов в списке охот */
    if (testURL(MAP)) {

        let reg = /name=\w+">(.+)<\/a/g;
        let mobs = parsePage(DATA, reg);

        if (mobs.length > 0) {

            let reg = /(\d+) шт./g;
            let amounts = parsePage(DATA, reg);

            mobs.forEach((mob, i) => {
                if (base.mobs[mob]) {
                    let points = base.mobs[mob][0];
                    let sel = qSelectAll('div > [href*="army_info"]')[i].parentNode;

                    let reg = RegExp(`(${amounts[i]} шт.)`);
                    let rep = `$1 x ${INFCOLOR + points} = ${points * amounts[i] + _HP}</span>`;
                    sel.innerHTML = sel.innerHTML.replace(reg, rep); // выводим результирующее значение ед.жизни
                }
            });
        }
    }

    /* Подсчёт единиц жизни монстров в ГН и ссылки на существ */
    if (testURL(/mercenary_guild/)) {

        let mon = parsePage(DATA, />(\W+)-монстр {(\d+)/g, true);

        if (mon.length > 0) {

            for (let i = 0; i < mon.length; i += 2) {

                if (base.mobs[mon[i]]) {

                    let hp = base.mobs[mon[i]][0];
                    let lvl = mon[i + 1];

                    if (hp < 50) hp = (hp % 10) + 50;
                    hp *= 36 * (lvl / 2 + 1);

                    let el = [...qSelectAll('b')].find(el => RegExp(mon[i]).test(el.textContent));
                    el.innerHTML = `<a href=army_info.php?name=${base.mobs[mon[i]][1]}>${mon[i]}</a>-монстр {${lvl}} ${INFCOLOR + hp + _HP}</span>`;
                }
            }
        }
    }
}


// Рынок. Отслеживание лотов

const tradeHelperGUI = async storage => {

    let tradelist = storage[userID + "_tradelist"], tradefound = storage[userID + "_tradefound"];

    // Экономическая статистика в Магазине
    if (testURL(/shop.php(?!.*(rent|potions|other|gift|transport))/)) ecoStat(storage);


    // Добавление сортировки к ссылке в профиле артефакта
    if (testURL(/art_info.php/) && storage[userID + "_extSort"]) {
        const link = qSelect('[class*="art_info_left"]>div>a[href*="auction"]');
        if (link) link.href += `&sort=${storage[userID + "_extSortType"]}`;
    }


    // Добавление сохранённой сортировки к кнопке "Назад" после ставки на рынке
    if (testURL(/auction_set_bid/) && storage[userID + "_extSort"]) {
        const link = qSelect('table.wbwhite>tbody>tr>td>a');
        link.href = link.href.replace(/sort=\d/, `sort=${storage[userID + "_extSortType"]}`);
    }


    // Рынок
    if (testURL(/auction.php/)) {

        let lots_amount = Object.keys(tradelist).length;
        if (storage[userID + "_key"]) MAX_LOTS = 40; // ключ активации обнаружен

        // Сортировка рынка по умолчанию
        if (storage[userID + "_extSort"]) defaultSort(storage);

        /* Просмотр личной страницы рынка */

        if (testURL(/cat=my|type=undefined|php$/)) {

            let sel = qSelect('td.wbwhite');

            let htmldata = `<br><br><table width="65%" align="center" border="0" cellpadding="2" cellspacing="0"><tbody>`
                + `<tr bgcolor="#afa"><td colspan="2">HWM Tool. Отслеживаемые лоты (${lots_amount} из ${MAX_LOTS})</td><td colspan="1" id="timer" align="right"></td></tr><tr bgcolor="#ddd"><td width="250">Тип арта</td>`
                + `<td align="center" width="30%">Цена боя/лота &lt;</td><td width="10%"></td></tr>`;

            if (lots_amount > 0) {

                // сортируем лоты по названию в алфавитном порядке
                const sorted = sortObject(tradelist);

                sorted.forEach((elem, i) => {

                    let lot = elem[0];

                    let lot_name = elem[1][0];
                    let lot_img = elem[1][1];
                    let lot_price = elem[1][2];
                    let lot_link = elem[1][3];

                    let color = (i % 2) ? "#eee" : "#fff";
                    let foundpay = '';

                    if (lot in tradefound) {
                        color = '#ffd';
                        foundpay = `(${tradefound[lot]})`;
                    }

                    htmldata += `<tr bgcolor=${color}><td><table><tbody><tr><td><div${getIconBGClass(/cat=(\w+)/.exec(lot_link)[1])}><a href="auction.php?${lot_link}"><img class=tradeitem src="${IMG_LINK}${lot_img}"></a></div></td><td><p>${lot_name}</p></td></tbody></table></td>`
                        + `<td align="center"><span style="color:#0a0">${foundpay}</span> ${lot_price}</td><td><input data-remove="${lot}" type="button" value="Убрать"></td></tr>`;

                    // Завершаем отрисовку таблицы
                    if (i == lots_amount - 1) {
                        sel.insertAdjacentHTML('beforeend', `${htmldata}</tbody></table><br><br>`);

                        let timer = qSelect('#timer');
                        CROM.addListener(request => {
                            if (request.content == 'tradeTimer') {
                                timer.innerHTML = request.timer[0] + ':' + request.timer[1];
                            }
                        });

                        const removebtns = qSelectAll('[data-remove]');

                        removebtns.forEach(btn => {
                            addListener(btn, 'click', () => {
                                const id = btn.dataset.remove;
                                // удаляем ключи из объектов
                                delete tradelist[id];
                                if (id in tradefound) delete tradefound[id];

                                setStorage({ [userID + "_tradelist"]: tradelist, [userID + "_tradefound"]: tradefound });

                                location.reload();
                            });
                        });
                    }
                });
            } else {
                sel.innerHTML += `${htmldata}<tr><td>Нет отслеживаемых лотов</td></tr></tbody></table>`;
                CRSM({ 'tradehelp_off': true });
            }

        } else {

            /* Страницы лотов */

            let link = location.href; // общая ссылка 
            let typetxt, reg, lot_type;
            // Если ссылка содержит type=[1-6], значит это ресурс(дерево, уголь и т.п.), работаем как с ресурсом.
            // В обратном случае - это арт
            if (testURL(/&type=[1-6]/)) {
                reg = /type=(\d)/, typetxt = 'type';
            } else {
                reg = /art_type=([\w-]+)/, typetxt = 'art_type';
            }
            // тип арта

            if (reg.exec(link)) lot_type = RegExp.$1
            else return analyzePrices(DATA, tradelist); // просмотр общих каталогов - выводим только цены за бой

            let lot_cat = /cat=(\w+)/.exec(link)[1]; // каталог

            let lot_img, lot_name;

            // Получаем картинку и название лота
            switch (lot_cat) {

                case 'cert':
                    lot_img = 'house_cert.jpg';
                    lot_name = `Сертификат (${getArtSector(lot_type)})`;
                    break;

                case 'dom':
                    lot_img = 'auc_dom.gif';
                    lot_name = `Дом (${getArtSector(lot_type)})`;
                    break;

                case 'obj_share':
                    lot_img = 'obj_share_pic.png';
                    lot_name = `Акция (${getArtSector(lot_type)})`;
                    break;

                case 'elements':
                    lot_img = `gn_res/${lot_type}.png`;
                    lot_name = ELEMENTS[lot_type];
                    break;

                case 'res':
                    lot_img = `r\/48\/${RESOURCES[lot_type - 1]}.png`;
                    lot_name = RES_NAMES[lot_type - 1];
                    break;

                case 'part':
                    lot_img = `artifacts/parts/${lot_type}.png`;
                    lot_name = `${base.arts[lot_type.slice(5)][0]} (1/100 часть)`;
                    break;

                default:
                    if (base.arts[lot_type]) {
                        let img = base.arts[lot_type][1];
                        /\/$/.test(img) && (img += lot_type);
                        lot_img = `artifacts/${img || lot_type}.png`;
                        lot_name = base.arts[lot_type][0];
                    } else {
                        // вытаскиваем через регулярку, чтобы поддержать новые арты без обновления расширения
                        const art_data = /(artifacts\/(?:\w+\/)*[\w-]+.png).+?"([а-яё\w`\- ]+) /i.exec(DATA);
                        if (!art_data) return // лотов нет
                        lot_img = art_data[1];
                        lot_name = art_data[2];
                    }
            }

            // нет ни одного лота
            if (!/lot_protocol/.test(DATA)) {
                const sel = qSelect('.wbwhite');
                let html = `<br><center>Ни одного лота "${lot_name}" не обнаружено.`;
                html += `<br><br><div${getIconBGClass(lot_cat)}><img class=tradeitem src=${IMG_LINK}${lot_img}></div>`;

                sel.insertAdjacentHTML('beforeend', html);
            }

            let sel = qSelect('td[colspan="4"]');
            let div = document.createElement('div');
            sel.append(div);

            if (!tradelist[lot_type] && lots_amount == MAX_LOTS) {

                div.innerHTML = '<span class="addlot">Достигнуто максимальное число отслеживаемых лотов</span>';

            } else if (lots_amount <= MAX_LOTS) {

                div.innerHTML = `<span class="addlot">Цена${SPECIAL_ART.test(lot_type) ? '' : ' боя'} \< <input onkeypress='return /\\d/.test(event.key)' id="lotprice" value="${(tradelist[lot_type] ? tradelist[lot_type][2] : "")}" type="text" maxlength="7" size="4" placeholder="0"/> <input id="addbtn" type="button" value="${(tradelist[lot_type] ? "Обновить" : "Отслеживать")}"/></span>`;

                addbtn.disabled = !tradelist[lot_type];

                addListener(lotprice, 'input', e => {
                    let p = e.target.value;
                    addbtn.disabled = (p == '' || p == 0);
                });

                // Формируем ссылку лота для сохранения
                let lot_link = `cat=${lot_cat}&${typetxt}=${lot_type}&sort=204`;
                if (/"">Только продажа/.test(DATA)) {
                    lot_link += '&sbn=1&sau=0';
                } else if (/"">Только торги/.test(DATA)) {
                    lot_link += '&sbn=0&sau=1';
                } else {
                    lot_link += '&sbn=0&sau=0';
                }
                lot_link += (qSelect('[name=chb3]').checked) ? '&snew=1' : '&snew=0';

                addListener(addbtn, 'click', () => {
                    if (lot_type in tradefound) delete tradefound[lot_type];
                    let lot_price = +lotprice.value;
                    tradelist[lot_type] = [lot_name, lot_img, lot_price, lot_link];

                    setStorage({ [userID + "_tradelist"]: tradelist, [userID + "_tradefound"]: tradefound });

                    CRSM({ 'tradehelp': true }); // запускаем таймер (на случай, если это первый добавленный лот)
                    location = 'auction.php'; // переход на главную страницу рынка
                });
            }

            analyzePrices(DATA, tradelist, lot_type);
        }
    }
}

const getArtSector = lot_type => Object.keys(base.sectors).find(key => base.sectors[key] == lot_type.slice(-2));
const getIconBGClass = data => SPECIAL_CAT.test(data) ? '' : ' class="tradeitem item-bg"';


// сортировка по умолчанию
const defaultSort = storage => {

    const sortType = storage[userID + "_extSortType"];
    const sel = qSelect('td.wblight[valign="top"]');

    addListener(sel, 'click', e => {

        const t = e.target;

        if (/FONT|IMG/.test(t.tagName)) {
            e.preventDefault();
            injectSortToLink(t.parentNode.href, sortType);

        } else if (/sort=/.test(t.getAttribute('href'))) {
            e.preventDefault();
            injectSortToLink(t.href, sortType);
        }
    });
}

const injectSortToLink = (link, sortType) => {
    const href = link.replace(/sort=\d*/, `sort=${sortType}`);
    location = href;
}


/* ВЫСТАВЛЕНИЕ АРТА НА ПРОДАЖУ */

const newLot = async storage => {

    if (/Достигнуто|Все верно|успешно|Неверные/.test(DATA)) {
        return sessionStorage.removeItem('market_data');
    }

    const sel = qSelect('#sel'); // поле выбора арта

    if (sel.length == 0) return; // нет артов на продажу

    const price_field = qSelect('[name=price]');

    price_field.insertAdjacentHTML('afterend', '&nbsp;<span style="display:none" id="ppb_block"><input id="ppb_field" value=0 size=1> за бой</span');

    const ppb_block = qSelect('#ppb_block');
    const ppb_field = qSelect('#ppb_field');

    const submit_btn = qSelect('#first_submit_button');

    let art, cat, strength, prices, link, SPECIAL;

    let session = sessionStorage.getItem('market_data');


    // Показываем окошко цены за бой
    const PPB_DISPLAY = _ => {
        SPECIAL = SPECIAL_ART.test(art);
        ppb_block.style.display = SPECIAL ? 'none' : 'inline';
    }


    // Проверка выбранной опции
    const checkOption = async () => {

        const value = sel.value;
        art = cat = prices = link = null;

        ppb_field.value = price_field.value = 0;

        const el_keys = Object.keys(ELEMENTS);

        // обычные арты
        if (/(.+)@/.test(value)) {
            art = RegExp.$1;
            if (base.arts[art]) {
                cat = base.arts[art][4].split('|')[1];
            } else {
                // арта нет в базе - определяем каталог вручную
                const auc_page = await loadPage('auction.php');
                const reg = RegExp(`(\\w+)#${art}`);
                cat = reg.exec(auc_page)[1];
            }
            strength = /(\d+)\//.exec(sel.options[sel.selectedIndex].text)[1];
        }
        // ресурсы
        else if (value == 'wood') art = 1;
        else if (value == 'ore') art = 2;
        else if (value == 'mercury') art = 3;
        else if (value == 'sulphur') art = 4;
        else if (value == 'crystal') art = 5;
        else if (value == 'gem') art = 6;
        // элементы
        else if (value == 'EL_42') art = el_keys[0];
        else if (value == 'EL_43') art = el_keys[1];
        else if (value == 'EL_46') art = el_keys[2];
        else if (value == 'EL_44') art = el_keys[3];
        else if (value == 'EL_45') art = el_keys[4];
        else if (value == 'EL_40') art = el_keys[5];
        else if (value == 'EL_37') art = el_keys[6];
        else if (value == 'EL_41') art = el_keys[7];
        else if (value == 'EL_39') art = el_keys[8];
        else if (value == 'EL_78') art = el_keys[9];
        else if (value == 'EL_38') art = el_keys[10];
        // сертификаты
        else if (/CERT_(\d+)/.test(value)) art = `sec_${RegExp.$1}`, cat = 'cert';
        // части артефактов
        else if (/ARTPART_(.+)/.test(value)) art = `part_${RegExp.$1}`, cat = 'part';
        // дома
        else if (/DOM/.test(value)) art = 'dom_';
        // акции
        else if (/SHARE/.test(value)) art = 'sha_';

        if (/^\d$/.test(art)) cat = 'res';
        if (/EL_/.test(value)) cat = 'elements';

        PPB_DISPLAY();
    }

    // если переход осуществлен из инвентаря с хэшем
    if (session) {

        sessionStorage.removeItem('market_data');
        const hash = /(.+)&(.+)/.exec(session);

        art = hash[1]; // ссылочное название арта
        strength = hash[2]; // прочность арта (X/Y)
        cat = base.arts[art][4].split('|')[1]; // каталог

        const options = qSelectAll(`option[value^="${art}"]`); // выбираем все арты по названию из списка

        for (let o of options) {
            // останавливаемся на арте с соответствующей прочностью
            if (o.textContent.includes(strength)) {
                sel.value = o.value; // выбираем арт из списка
                break;
            }
        }

        strength = /(\d+)/.exec(strength)[1]; // оставляем только первую прочность (X)

        PPB_DISPLAY();

    } else {

        await checkOption();
    }

    // подготавливаем таблицу для вставки лотов с рынка
    qSelectAll('center')[NEWSTYLE ? 1 : 0].insertAdjacentHTML('beforeend', `<br><table class="wbwhite" width="970px"><tbody><tr><td id="lots_table"></td></tr></tbody></table><br>`);
    const lots_table = qSelect('#lots_table');



    // Получение страницы лота с рынка
    const getLots = async () => {

        const tradelist = storage[userID + "_tradelist"];

        sel.blur(); // снимаем фокус с поля, чтобы избежать быстрого прокручивания стрелками

        let html = `<td>Ни одного лота не обнаружено на рынке.</td>`;
        let message = '', type = 'art_type';

        if (/^\d$/.test(art)) {
            type = 'type';
        }

        // ищем арт на рынке и определяем каталог, если есть - формируем ссылку

        if (art == 'dom_') {
            link = 'auction.php?cat=dom&sort=4';
            message = '&nbsp;Все дома, выставленные на продажу';
        } else if (art == 'sha_') {
            link = 'auction.php?cat=obj_share&sort=4';
            message = '&nbsp;Все акции, выставленные на торги';
        } else {
            link = `auction.php?cat=${cat}&${type}=${art}${MARKET_FILTERS}`;
        }

        lots_table.innerHTML = `<center>${_LOADING}`;

        // загружаем страницу лота с рынка 
        const page = await loadPage(link);

        const xmlDoc = new DOMParser().parseFromString(page, "text/html");
        const table = qSelect('table[cellpadding="4"]>tbody', xmlDoc);
        const trs = qSelectAll('tr[bgcolor]', table);

        // Если в полученной таблице нет лотов (ситуация поменялась с момента последней загрузки рынка)
        if (trs.length == 2) {

            link = null;

        } else {

            trs[0].remove(); // убираем заголовок

            // удаляем ячейки с кнопками продажи и именем продавца
            trs.forEach((tr, i) => {
                // отмечаем свои выставленные арты
                if (tr.lastChild.innerHTML.includes(userID)) {
                    tr.setAttribute('bgcolor', i % 2 ? '#a09cea' : '#9adeed');
                }

                tr.lastChild.remove();
            });

            html = table.innerHTML;
        }



        if (tradelist[art]) message = `<b>&nbsp;Вы отслеживаете '${tradelist[art][0]}' по цене < ${tradelist[art][2] + (SPECIAL ? '' : ' за бой')}</b>`;

        // вставляем таблицу
        lots_table.innerHTML = `${message}<table width="100%" cellspacing="0" cellpadding="4"><tbody>${html}</tbody></table>`;


        // производим анализ цен и раскраску, если сформирована ссылка
        if (link) {
            const result = analyzePrices(document.body.innerHTML, tradelist, art);
            prices = SPECIAL ? result.map(n => +n.replace(/,/g, '')) : result;
        }
    }


    getLots();


    // отображение предполагаемой позиции лота
    const setPredict = ppb => {

        if (prices) {

            const predpos = qSelect('#predpos');
            predpos && predpos.remove();

            if (ppb && ppb > 0) {
                const arr = [...prices, ppb].sort((a, b) => a - b);

                // для элементов и ресурсов при равных ценах лот ставится на позицию после всех (возможно, есть ещё особенности?)
                const idx = /elements|res/.test(cat) ? arr.lastIndexOf(ppb) : arr.indexOf(ppb);

                const trs = qSelectAll('table[cellpadding="4"]>tbody>tr[bgcolor]');
                trs[idx].insertAdjacentHTML('afterend', '<tr id="predpos"><td class="predpos" colspan="100%"><center>Предполагаемая позиция лота</td></tr>');
            }
        }
    }

    // список лотов
    addListener(sel, 'change', async () => {
        await checkOption();
        getLots();
    });

    // поле ввода цены
    addListener(price_field, 'input', () => {
        // берем цену за бой либо просто цену в зависимости от типа арта
        const ppb = SPECIAL ? +price_field.value : calcPPB(price_field.value, strength);
        // Если список цен получен, то определяем позицию лота в завимисости от цены за бой
        setPredict(ppb);
        ppb_field.value = ppb;
    });

    // поле ввода цены за бой
    addListener(ppb_field, 'input', () => {
        const ppb = +ppb_field.value;
        setPredict(ppb);
        price_field.value = ppb * strength | 0;

        submit_btn.disabled = !ppb;
    });
}


// Анализ цен для вывода цены за бой и дальнейшей раскраски лотов
const analyzePrices = (DATA, tradelist, lot_type = null) => {

    // Отображаем цену боя артов, исключаем специфичные лоты
    const reg = /<div id="au\d+".+?>([\d,]+)/g; // цена
    const prices = parsePage(DATA, reg);

    if (prices.length == 0) return;

    // дополнительная проверка на каталог, если просматриваются общие каталоги без определенного арта (lot_type = null)
    if (SPECIAL_ART.test(lot_type) || testURL(RegExp(`cat=(?:${SPECIAL_CAT.source})`))) {

        if (lot_type && tradelist[lot_type]) prices.forEach((price, i) => colorLot(price.replace(/,/g, ''), tradelist[lot_type][2], i));
        return prices;

    } else {

        const reg = /<br>Прочность: .*?(\d+)/g; // прочность
        const strengths = parsePage(DATA, reg);

        const sel = qSelect('tr[bgcolor*="d"]>td[align="left"]');
        sel.textContent += ' (за бой)';

        const ppb_arr = [];

        prices.forEach((price, i) => {
            const sel = qSelectAll('div[id^="au"] > table > tbody > tr > td:nth-child(2)')[i];
            const battlepay = calcPPB(price.replace(/,/g, ''), strengths[i]);
            ppb_arr.push(battlepay);
            sel.innerHTML += ` <span style="color:#00c">(${battlepay})</span>`;
            if (lot_type && tradelist[lot_type]) colorLot(battlepay, tradelist[lot_type][2], i);
        });

        return ppb_arr;
    }
}



// Выделяем цветом лоты по цене ниже установленной
const colorLot = (price, goodprice, i) => {
    let tr = qSelectAll('tr.wb')[i];

    if (price < goodprice) {
        tr.setAttribute('bgcolor', '#ffd');
        tr.lastChild.setAttribute('bgcolor', '#ffd');
    }
}



// вычисление цены за бой
const calcPPB = (p, s) => +(p / s).toFixed(2);


// Вычисление цен и стоимости боя артов
const ecoStat = storage => {

    const art_containers = qSelectAll('.s_art');

    let len = 0;

    checkBlocks(art_containers, len, storage);
    addListener(window, 'scroll', () => checkBlocks(art_containers, len, storage));

}

const checkBlocks = async (art_containers, len, storage) => {

    for (let container of art_containers) {

        // Плавная загрузка только тех элементов, которые видны
        if (isInViewport(container) && !container.checked) {

            container.checked = true; // отмечаем уже показанные элементы

            const strength = qSelectAll('.s_art_prop_amount', container)[1].textContent;
            const art = /art_info.php\?id=([\w-]+)/.exec(container.innerHTML)[1];

            let bp1 = Infinity;
            let html = '';
            const priceline = qSelect('.s_art_prop', container);

            if (!/рыночная цена/.test(container.innerHTML)) {

                const pr_elem = qSelectAll('.shop_res_img', priceline);

                let price = 0;

                for (let i = 0; i < pr_elem.length; i++) {

                    const e = /(\w+).png/.exec(pr_elem[i].innerHTML)[1]; // определяем ресурс по картинке
                    const num = +/(\d+,*\d*)/.exec(pr_elem[i].textContent)[1].replace(/,/g, ''); // количество ресурса

                    if (e == 'gold') price += num;
                    if (/wood|ore/.test(e)) price += num * 180;
                    if (/merc|sulf|crys|gem/.test(e)) price += num * 360;
                }

                bp1 = calcPPB(price, strength); // цена за бой в магазине

                html = `<div id='stat1'>В магазине: ${price}. За бой: ${bp1}</div>`;
            }

            html += `<div id='stat2'>${_LOADING}</div><div id='stat3'>${_LOADING}</div><br>`;
            priceline.insertAdjacentHTML('afterend', html);


            let stat2 = qSelect('#stat2', container);
            let stat3 = qSelect('#stat3', container);


            // Вытаскиваем цену из статистики предприятий

            let bp2 = Infinity;

            if (/ecostat/.test(container.innerHTML)) {
                const page = await loadPage(`ecostat_details.php?r=${art}`);

                const query = /(?:[1-9][\d,]*)&nbsp;<\/td><td align=center>&nbsp;([\d,]+)/.exec(page); // берём предприятия с ненулевым количеством товаров
                if (query) {
                    const price = query[1].replace(/,/g, '');
                    bp2 = calcPPB(price, strength);
                    stat2.innerHTML = `На карте: ${price}. За бой: ${bp2}`;
                } else {
                    stat2.remove();
                }
            } else {
                stat2.remove();
            }


            // Вытаскиваем цену с рынка

            let bp3 = Infinity;

            const params = `sbn=1&sau=${storage[userID + "_extMarketFilter"] ? 0 : 1}`; // фильтр "Только продажа"

            const auc_btn = qSelect('[href*="auction.php"]', container);

            if (auc_btn) {
                // меняем ссылку поиска по рынку
                const href = auc_btn.href + '&sort=204&snew=0&' + params;
                auc_btn.setAttribute('href', href);

                const page = await loadPage(href);

                if (/<div id="au\d+".+?>([\d,]+)/.exec(page)) {
                    let price = RegExp.$1.replace(/,/g, '');
                    let strength = /<BR>Прочность: .*?(\d+)/.exec(page)[1];
                    bp3 = calcPPB(price, strength);
                    stat3.innerHTML = `На рынке: ${price}. За бой: ${bp3}`;
                } else {
                    // блокируем кнопку поиска, если данных артов нет на рынке
                    auc_btn.firstChild.classList.add('s_art_btn_disabled');
                    auc_btn.removeAttribute('href');

                    stat3.remove();
                }

            } else stat3.remove();

            // Находим наиболее выгодную по цене за бой позицию
            let arr = [bp1, bp2, bp3];
            let winner = arr.indexOf(Math.min(...arr)) + 1;
            let winpos = qSelect(`#stat${winner}`, container);

            winpos.className = 'winpos';

            len++;
        }
    }

    if (len == art_containers.length) {
        window.removeEventListener('scroll', checkBlocks);
    }
}


// Проверка на видимость элемента на экране
const isInViewport = elem => {
    let bounding = elem.getBoundingClientRect();
    return (bounding.top >= 0 && bounding.bottom <= window.innerHeight + 100);
}


// ГО
const goGUIService = () => {

    if (testURL(MAP)) {
        // Отслеживаем нажатие на кнопки "Напасть" или создание парной охоты на карте
        addListener(document, 'click', e => {

            if (e.target.value == 'Позвать') CRSM({ 'goHelp': true });

            else if (/HuntBtnGold_Attack/.test(e.target.src)) CRSM({ 'goClear': true });

            else if (/HuntBtnGold_Pass/.test(e.target.src)) {

                // пропуск охоты без перезагрузки страницы
                const runTimer = _ => {
                    observer.disconnect();
                    const timer = /(\d+) мин. (\d+)/.exec(document.body.innerHTML);
                    const SECONDS = timer[1] * 60 + +timer[2];
                    CRSM({ 'goPass': true, SECONDS });
                }

                const observer = new MutationObserver(runTimer);
                observer.observe(qSelect('#map_hunt_block_div'), { childList: true, subtree: true });

            }
        });
    }
}


// ГН
const gnGUIService = async _ => {
    // если автоГО или автоГН
    if (testURL(/waiting_for_results/)) {
        // отслеживаем нажатие на кнопку возвращения в ГН после автобоя, чтобы переопределить текущий сектор
        const btn = qSelect('[value*="Вернуться"]');
        if (btn) {
            addListener(btn, 'click', _ => {
                sessionStorage.setItem('checkSector', true);
            });
        }

        // перепроверяем состояние ГО (сброс таймера)
        CRSM({ 'goClear': true });
    }

    // переопределяем текущий сектор игрока на странице ГН, если происходит переход в гильдию после автобоя
    if (testURL(/mercenary_guild/) && sessionStorage.getItem('checkSector')) {
        sessionStorage.removeItem('checkSector');

        const page = await loadPage('map.php');
        const sector = getCurrentSector(page);

        setStorage({ sector });
    }

    if (testURL(MAP)) {
        const btn = qSelect('[onclick*="accept_merc"]');
        if (btn) {
            addListener(btn.firstChild, 'click', e => {
                CRSM({ 'gnClear': true });
            });
        }
    }
}


// ГЛ
const glGUIService = () => {
    if (testURL(/leader_guild/)) {
        addListener(document, 'click', e => {
            if (e.target.value == 'Напасть') CRSM({ 'glClear': true });
        });
    }
}


// ГВ
const gvGUIService = storage => {

    if (testURL(/thief_guild/) && /засаду/.test(DATA)) {

        const td = qSelect('td > b').parentNode;

        const { gv_boost, gv_koef, gv_pryanik, abubekr } = storage;
        const boost = (abubekr ? 0.7 : 1) * (1 - gv_koef / 100) * (gv_pryanik ? 0.2 : 1);
        const thief_time = 60 * boost | 0;

        let html = `Время ожидания после поражения: ${gv_boost ? '0' : thief_time} мин.`;
        html += `<br>Благословение Абу-Бекра: ${abubekr ? '<b>Да</b> (30%)' : 'Нет'}`;
        html += `<br>Ускорение Гильдии Воров: ${gv_boost ? `<b>Да</b> (100%)` : 'Нет'}`;
        html += `<br>Пряник или Плюшка: ${gv_pryanik ? `<b>Да</b> (х5)` : 'Нет'}`;
        html += `<br>Праздничное ускорение: ${gv_koef ? `<b>Да</b> (${gv_koef}%)` : 'Нет'}`;
        html += `<br><br><input id='refresh' type='button' value='Обновить значения'>`;
        td.insertAdjacentHTML('beforeend', html);

        const btn = qSelect('#refresh');

        addListener(btn, 'click', e => {

            btn.disabled = true;
            btn.value = 'Обновляю...';

            CRSM({ 'gv_refresh': true });
        });
    }
}


// ГН Бот
const gnBot = () => {

    // выбор задания и переход в сектор выполнения
    if (testURL(/mercenary_guild/)) {

        const linksA = qSelectAll('input[value*="Принять"]'); // принятие заданий
        const linksM = qSelectAll('a[href*="map.php?cx"]'); // сектора

        const sign = /sign=(\w+)/.exec(DATA)[1];

        for (let i = 0; i < linksA.length; i++) {

            linksA[i].value += ' и отправиться';

            addListener(linksA[i], 'click', async e => {
                e.preventDefault();
                CRSM({ 'gnAccept': true });
                await fetch(`mercenary_guild.php?action=accept${i == 1 ? '2' : ''}&sign=${sign}`, { redirect: 'manual' });

                const sectorName = linksM[i].textContent;
                const sectorId = base.sectors[sectorName];
                setStorage({ trackto: 'gn-start' });

                location = `move_sector.php?id=${sectorId}`;
            });
        }
    }
}


// Кнопки выхода по завершении боёв
const gnBotBattle = storage => {

    const btype = /btype\|(\d+)/.exec(DATA)[1];

    // если бой ГН 
    if (/^(?:5|7|8|10|12|28|29)$/.test(btype)) {

        const result = qSelect('#win_BattleResult');
        const btn = qSelect('#btn_continue_WatchBattle');
        const newbtn = btn.cloneNode(true);
        newbtn.textContent = 'Вернуться в ГН';

        // Отслеживаем появление результатов боя
        const waitForResult = async _ => {

            observer.disconnect();

            if (btype == '12') {

                // Армии
                // Проверяем страницу ГН
                // Если на странице нет надписи об оставшихся попытках - значит можно возвращаться в ГН

                const PAGE = await loadPage('mercenary_guild.php');
                if (!/осталось\s+\d/.test(PAGE)) {
                    btn.remove();
                    result.append(newbtn);
                    addListener(newbtn, 'click', _ => gnAutoReturn(storage));
                }

            } else {
                // остальные типы заданий ГН
                btn.remove();
                result.append(newbtn);
                addListener(newbtn, 'click', _ => gnAutoReturn(storage));
            }
        }

        const observer = new MutationObserver(waitForResult);
        observer.observe(result, { attributes: true });
    }
}


const gnAutoReturn = storage => {

    const returnTable = {
        '1': '2', // Empire Capital
        '2': '2', // East River
        '3': '6', // Tiger Lake
        '4': '2', // Rogues' Wood
        '5': '2', // Wolf Dale
        '6': '6', // Peaceful Camp
        '7': '2', // Lizard Lowland
        '8': '2', // Green Wood
        '9': '6', // Eagle Nest
        '10': '2', // Portal Ruins
        '11': '2', // Dragons' Caves
        '12': '6', // Shining Spring
        '13': '6', // Sunny City
        '14': '2', // Magma Mines
        '15': '16', // Bear Mountain
        '16': '16', // Fairy Trees
        '17': '2', // Harbour City
        '18': '16', // Mythril Coast
        '19': '21', // Great Wall
        '20': '21', // Titans' Valley
        '21': '21', // Fishing Village
        '22': '21', // Kingdom Castle
        '23': '6', // Ungovernable Steppe
        '24': '6', // Crystal Garden
        '26': '2', // The Wilderness
        '27': '6' // Sublime Arbor
    }

    // если уже находимся в секторе ГН, то сразу переходим туда, иначе отправляемся в путь
    if (!/East River|Peaceful Camp|Fairy Trees|Fishing Village/.test(storage.sector)) {
        const retSector = returnTable[base.sectors[storage.sector]];
        setStorage({ trackto: 'gn-end' });
        location = `move_sector.php?id=${retSector}`;
    }
}


// Парсер протокола передач

const protocolParser = () => {

    const div = qSelect('[class="global_a_hover"]');
    const lines = parsePage(DATA, /(&nbsp;&nbsp;.+)<br>/g);

    let sum = 0, gold = 0, newline, com, html = '';

    for (let line of lines) {

        newline = line;
        // Обмен бриллиантов на золото:
        //  "2 бриллианта обменяно на 10000 золота"
        if (/обменян/.test(line)) {
            gold = +/на <b>(\d+)/.exec(line)[1];
            newline = makeLine(line, '+' + gold, 'green');
            sum += gold;
        }

        // Передача золота игроку\клану:
        //  "Передано 100000 Золото для bratishkinoff, доп. комиссия 1000: В долг"
        //  "Передано 65000 золота на счет клана #9704"
        if (/nbsp;[\d- :]+ Передано \d+ (?:Золото|золота)/.test(line)) {
            com = /комиссия (\d+)/.exec(line);
            gold = -/(\d+) (?:Золото|золота)/.exec(line)[1] - (com ? com[1] : 0);
            newline = makeLine(line, gold, 'red');
            sum += gold;
        }

        // Получение предмета\элемента за золото:
        //  "Получен предмет 'Амулет вора' [60/60] от Что_то_с_чем_то за 7 Золото"
        //  "Получен элемент 'цветок ветров' 1 шт. от naTcaHx за 2400 золота"
        if (/Получен .+?за \d+ (?:Золото|золота)/.test(line)) {
            gold = -/за (\d+)/.exec(line)[1];
            newline = makeLine(line, gold, 'red');
            sum += gold;
        }

        // Передача предмета\элемента за золото:
        //  "Передан предмет 'Великий меч полководца' [81/89] c возвратом до 25-01-20 22:20 на 81 боев для Nexik за 1 Золото, комиссия 1"
        //  "Передан элемент 'абразив' 1 шт. для Algor за 950 золота, комиссия 10"
        // Продажа лота на рынке:
        //  "Продан предмет "Клевер фортуны" [57/68] за 63999 золота для Astronics - лот #101698940, комиссия: 640"
        if (/nbsp;[\d- :]+ (?:Передан .+?\d+ (?:Золото|золота)|Продан)/.test(line)) {
            com = /комиссия:* (\d+)/.exec(line);
            gold = +/за (\d+)/.exec(line)[1] - (com ? com[1] : 0);
            newline = makeLine(line, '+' + gold, 'green');
            sum += gold;
        }

        // Получение предмета и золота за ремонт:
        //  "Получен предмет 'Клинок феникса' [0/73] на ремонт от Крюгерс. Получено за ремонт: 9212 (101%)"
        if (/Получен .+?на ремонт/.test(line)) {
            const g = /ремонт: (\d+)/.exec(line)[1];
            const p = /(\d+)%/.exec(line)[1];
            gold = Math.ceil(g / p) * (p - 100); // вычисляем фактический доход кузнеца
            if (gold >= 0) {
                newline = makeLine(line, '+' + gold, 'green');
            } else {
                newline = makeLine(line, gold, 'red');
            }
            sum += gold;
        }

        // Передача арта кузнецу и плата за ремонт арта:
        //  "Передан предмет 'Меч холода' [0/53] на ремонт для Евфлантовичок. Оплачено за ремонт: 17600 (100%), доп. комиссия: 17"
        if (/Оплачено за/.test(line)) {
            gold = -/ремонт: (\d+)/.exec(line)[1] - /комиссия: (\d+)/.exec(line)[1];
            newline = makeLine(line, gold, 'red');
            sum += gold;
        }

        // Аренда арта:
        //  "Арендован артефакт 'Кольцо солнца' [52/66] у "Склада" #38 (Клан #1519) на 5 боев до 2020.03.22 11:01. Стоимость: 1060, комиссия: 11"
        if (/Арендован/.test(line)) {
            gold = -/Стоимость: (\d+)/.exec(line)[1] - /комиссия: (\d+)/.exec(line)[1];
            newline = makeLine(line, gold, 'red');
            sum += gold;
        }

        // Получение золота от игрока или Империи:
        //  "Получено 101000 Золото от bratishkinoff"
        //  "Получено 12755 золота от Империя: Победа в 277-м турнире на выживание среди 7 уровней, Маги! Первый результат. +10 очков ГО."
        // Взятие денег с клана\дома:
        //  "Взято 75000 золота со счета клана #2304: закупка элементов"
        //  "Взято 150000 золота со счета "Дома" #1448"
        // Заработок кузнеца с ремонта складского арта:
        //  "Взят в ремонт артефакт 'Кинжал пламени' [0/57] у "Склада" #2 (Клан #276) до 2020.03.07 19:47. Заработано: 208 золота"
        if (/Получено \d+ (?:Золото|золота)|Взято|Заработано/.test(line)) {
            gold = +/(\d+) (?:Золото|золота)/.exec(line)[1];
            newline = makeLine(line, '+' + gold, 'green');
            sum += gold;
        }

        // Возвращение неиспользованного арта с возвратом денег:
        //  "Вернул 'Лук света' [28/74] на "Склад" #38 (Клан #1519). Неиспользовано боев: 1. Возврат золота: 236"
        if (/Неиспользовано/.test(line)) {
            gold = +/золота: (\d+)/.exec(line)[1];
            newline = makeLine(line, '+' + gold, 'green');
            sum += gold;
        }

        // Штраф игрока:                     "Игрок оштрафован на 60000 золота. // от Kentas-"
        // Оплата комнаты:                   "Оплачено 700 золота (100/д) за аренду комнаты #1 до 12:38 02-04, дом #101 (владелец: Ка-51к)"
        // Покупка лота с рынка:             "Куплен "лунный камень" за 2530 золота у UR1Y - лот #101770461"
        // Внесение золота на счёт дома:     "Внесено 60000 золота на счет "Дома" #1448"
        if (/Игрок оштрафован|Оплачено \d+|nbsp;[\d- :]+ Куплен|Внесено/.test(line)) {
            gold = -/(\d+) золота/.exec(line)[1];
            newline = makeLine(line, gold, 'red');
            sum += gold;
        }

        html += newline + '<br>';
    }

    div.innerHTML = html;

    // Баланс золота
    div.insertAdjacentHTML('beforeend', `<br><b style='padding:20'>Баланс золота: <span style='color:${sum < 0 ? 'red' : 'green'}'>${sum > 0 ? '+' : ''}${sum.toLocaleString('en-US')}</span></b>`);
}

const makeLine = (line, gold, color) => `<span style='background:rgba(${color == 'green' ? '100,255,100,.1' : '255,100,100,.1'})'>${line}&nbsp; <b style='color:${color}'>${gold}</b></span>`;


// Передача артов, ресурсов, элементов, подарков на праздниках 
// с выбором получателя из списка друзей

// el_transfer.php, art_transfer.php, transfer.php
// mart8_send.php, feb23_send.php, vd_send.php

const friendlyTransfer = async () => {

    const session = sessionStorage.getItem('pl_name');
    sessionStorage.removeItem('pl_name');

    const input = qSelect(`input[name="${testURL(/mart8|feb23|vd/) ? 'mailto' : 'nick'}"]`);

    if (input) {

        // Вставляем ник игрока, если он передается через сессию
        if (session) {

            input.value = session;

        } else {

            const list = await getFriendsList();

            input.parentNode.insertAdjacentHTML('beforeend', `&nbsp;<select style="width:136px" id="friends"><option selected disabled>Выбрать</option>${list}</select>`);

            addListener(qSelect('#friends'), 'change', e => {
                input.value = e.target.value;
                // делаем кнопку передачи активной
                const btn = qSelect('input[value*="П"]')
                if (btn) btn.disabled = false;
            });
        }
    }

    // переключаем тип передачи артефакта\элементов
    if (testURL(/art_|el_/)) qSelect(`input[value="${/value="2"/.test(DATA) ? 2 : 1}"]`).click();
}


const getFriendsList = async () => {
    // получаем список друзей
    const page = await loadPage('friends.php');
    const reg = /([\wа-яё\-\(\) ]+) \[/gi;
    const friends = parsePage(page, reg);

    let list;

    // отображаем список друзей
    for (const friend of friends) {
        list += `<option value="${friend}">${friend}</option>`;
    }
    return list;
}


// Ссылки на передачу элементов, ресурсов и артефактов из профилей игроков
const profileLinks = storage => {
    if (/>(?:\(заблок|East Island)/.test(DATA)) return;
    let pl_name = /<title>([\wа-яё\-\(\) ]+) \|/i.exec(DATA)[1];
    let el = qSelect('td[colspan="2"][valign=top]');
    el.innerHTML += `<br><br>Передать ресурсы [<a id="trans_res" href="javascript:void(0)">>></a>]&nbsp;&nbsp;<br>Передать элементы [<a id="trans_el" href="javascript:void(0)">>></a>]&nbsp;&nbsp;<br>Передать артефакты [<a id="trans_art" href="javascript:void(0)">>></a>]&nbsp;&nbsp;`;

    addListener(el, 'click', e => {
        if (/trans_(\w+)/.test(e.target.id)) {
            sessionStorage.setItem('pl_name', pl_name);
            if (RegExp.$1 == 'res') location = 'transfer.php';
            else if (RegExp.$1 == 'el') location = 'el_transfer.php';
            else {
                // если включена мультипередача, сразу перекидываем на эту вкладку после перехода в инвентарь
                if (storage[userID + '_mtrans']) sessionStorage.setItem('redirect', true);
                location = 'inventory.php';
            }
        }
    });
}


// Работа с Инвентарём

const inventoryUtils = storage => {

    let arts = getArtsFromPage();
    const block = qSelect('#inventory_block');
    const aucbtns = storage[userID + "_aucbtns"];
    let btn_srch, btn_sell;

    // кнопки поиска по рынку и выставления на продажу
    if (aucbtns) {
        qSelect('#inv_item_buttons').insertAdjacentHTML('beforeend', INV_BTNS);
        btn_srch = qSelect('.btn_srch');
        btn_sell = qSelect('.btn_sell');
    }

    // отслеживание нажатия на иконку арта - открытие меню
    addListener(block, 'click', () => {
        const art_div = qSelect('[class*=art_is_selected]');
        if (art_div) {
            const id = art_div.getAttribute('art_idx');
            const transfer_ok = arts[id][23]; // арт доступен для передач

            // кнопки поиска по рынку и выставления на продажу
            if (aucbtns) artBtns(arts[id], btn_srch, btn_sell, transfer_ok);

            // подсвечиваем кнопку передачи арта, если получено имя в сессии
            if (transfer_ok && sessionStorage.getItem('pl_name')) {
                const btn = qSelect('#inv_menu_transfer');
                btn.classList.remove('inv_item_select_img');
                btn.classList.add('translight');
            }
        }
    });

    // умный фон артефактов
    if (storage[userID + "_smartbg"]) {
        usedArts(arts);
        Mutation(block, () => {
            const cat = getCurrentCat();
            if (cat == 'mtrans') return;
            usedArts(arts);
        });
    }

    // Фильтры 
    if (storage[userID + '_ifilters']) {
        const div = qSelect('.filter_tabs_block_outer');
        div.insertAdjacentHTML('beforeend', '<div class=ifilters></div>');

        invFilters(arts);
        Mutation(block, () => invFilters(arts));
    }

    // Мульти-передача артов
    if (storage[userID + '_mtrans']) multiTransfer(arts, block);


    // заменяем ссылку возврата арендованых артов
    const script = document.createElement('script');
    let code = `const returnlink=document.querySelector('[href*="return_all"]');if(returnlink){const returnhref=returnlink.href;returnlink.href='#';`;
    code += `returnlink.addEventListener('click',_=>{swal({title:"",text:'Вы действительно хотите вернуть все артефакты с истёкшей арендой?',confirmButtonColor:"#DD6B55",cancelButtonText:"Отмена",confirmButtonText:"Да",showCancelButton:true,closeOnConfirm:true},_=>location=returnhref)})}`;
    script.textContent = code;
    document.body.append(script);
}


const getArtsFromPage = () => {
    // добавляем на страницу скрипт, скидывающий список артов в сессию
    const tempscript = qSelect('#tempscript');
    if (tempscript) tempscript.remove();
    const script = document.createElement('script');
    script.id = 'tempscript';
    script.textContent = `arts_obj={};arts.forEach((a, i)=>arts_obj[i]=Object.values(a));sessionStorage.setItem('arts_obj',JSON.stringify(arts_obj))`;
    document.body.append(script);

    return JSON.parse(sessionStorage.getItem('arts_obj'));
}


// отмечаем нецелые арты
const usedArts = arts => {
    // берем все эелементы с артами
    const a_divs = qSelectAll('.inventory_item_div');

    for (const div of a_divs) {
        const id = div.getAttribute('art_idx');
        const bg = qSelect('img[src*="art_fon"]', div);

        // сравниваем прочку
        if (arts[id][5] == 0) bg.classList.add('inv_brokenart');
        else if (arts[id][5] < arts[id][6]) bg.classList.add('inv_usedart');
    }
}

// кнопки инвентаря
const artBtns = (art, btn_srch, btn_sell, transfer_ok) => {

    const link = art[4]; // ссылочное название арта
    const dur1 = SPECIAL_ART.test(link) ? 1 : art[5]; // прочность
    const dur2 = art[6]; // прочность

    btn_srch.style.display = 'none';
    btn_sell.style.display = 'none';

    if (!base.arts[link]) return; // если арта в базе нет - выход

    let cat = base.arts[link][4]; // каталог арта
    if (cat) cat = cat.split('|');
    else return;

    const is_marketable = /2|3/.test(cat[0]);

    if (is_marketable) {
        btn_srch.style.display = 'block';
        if (transfer_ok && dur1 != 0) btn_sell.style.display = 'block';
    }

    btn_srch.onclick = e => location = `auction.php?cat=${cat[1]}&type=0&art_type=${cat[1] == 'part' ? 'part_' : ''}${link}${MARKET_FILTERS}`;

    btn_sell.onclick = e => {
        sessionStorage.setItem('market_data', `${link}&${dur1}/${dur2}`);
        location = 'auction_new_lot.php';
    };
}


const getCurrentCat = () => {
    const ftab = qSelect('.filter_tab_active');
    return ftab ? ftab.getAttribute('hint') : '';
}

// ФИЛЬТРЫ ИНВЕНТАРЯ

const invFilters = arts => {
    const container = qSelect('.ifilters');
    const cat = getCurrentCat();
    // не отображаем фильтры на вкладке мультипередачи
    if (cat == 'mtrans') {
        container.innerHTML = '';
        return;
    }

    // берем все эелементы с артами на текущей вкладке
    const a_divs = qSelectAll('.inventory_item_div');

    const html = `<div>ОА <select id=oalist><option selected value=all>Все</option></select></div><div>Владелец <select style="width:150px" id=ownerlist><option selected value=all>Все</option></select></div>`;
    container.innerHTML = html;

    const oa_options = getInvOA(arts, a_divs);
    const owner_options = getOwners(arts, a_divs, cat);

    const ownerList = qSelect('#ownerlist');
    const oaList = qSelect('#oalist');

    ownerList.innerHTML += owner_options;
    oaList.innerHTML += oa_options;

    // читаем сохранённые в сессии значения фильтров
    const session_oa = sessionStorage.getItem('filter_oa');
    const session_owner = sessionStorage.getItem('filter_owner');

    if (session_owner) {
        const option = qSelect(`option[value="${session_owner}"]`, ownerList);
        if (option) ownerList.value = session_owner;
    }

    if (session_oa) {
        const option = qSelect(`option[value="${session_oa}"]`, oaList);
        if (option) oaList.value = session_oa;
    }


    doFiltering(arts, oaList.value, ownerList.value, a_divs);

    for (const list of [oaList, ownerList]) {
        addListener(list, 'change', e => doFiltering(arts, oaList.value, ownerList.value, a_divs));
    }
}

const getInvOA = (arts, a_divs) => {

    const oa_set = new Set();

    for (const div of a_divs) {
        const id = div.getAttribute('art_idx');
        const oa = arts[id][40];
        oa_set.add(oa);
    }

    let oa_options = '';
    const sorted_oa = [...oa_set].sort((a, b) => a - b);

    // формируем опции ОА
    for (let oa of sorted_oa) {
        oa_options += `<option value="${oa}">${oa}</option>`;
    }

    return oa_options;
}

const getOwners = (arts, a_divs, cat) => {

    const rented = [];

    for (const div of a_divs) {
        const id = div.getAttribute('art_idx');
        const owner = arts[id][13];
        const owner_nik = arts[id][14];

        if (owner == -1) rented.push(_RENTSHOP);
        if (owner == -10) rented.push(_WAREHOUSE);
        if (owner > 0) rented.push(owner_nik);
    }

    let counts = {};
    rented.forEach(x => counts[x] = (counts[x] || 0) + 1); // подсчитываем сколько у владельцев артов в аренде
    const owners = new Set(rented);

    let owner_options = '';

    if (owners.size > 0) {

        if (cat != 'Аренда' && a_divs.length > rented.length) owner_options += '<option value=pers>Личное</option>';

        for (const owner of owners) {
            owner_options += `<option value="${owner}">${owner} (${counts[owner]})</option>`;
        }
    }

    return owner_options;
}


const doFiltering = (arts, filter_oa, filter_owner, a_divs) => {

    sessionStorage.setItem('filter_oa', filter_oa);
    sessionStorage.setItem('filter_owner', filter_owner);

    for (const div of a_divs) {
        const id = div.getAttribute('art_idx');
        const oa = arts[id][40];
        const owner = arts[id][13];
        let owner_nik = arts[id][14];

        if (owner == -1) owner_nik = _RENTSHOP;
        if (owner == -10) owner_nik = _WAREHOUSE;

        if ((filter_oa != 'all' ? filter_oa == oa : true)
            && (filter_owner != 'all' ? filter_owner == 'pers' ? owner == 0 : filter_owner == owner_nik : true)) div.style.display = 'block';
        else div.style.display = 'none';
    }
}


// МУЛЬТИПЕРЕДАЧА АРТЕФАКТОВ

const multiTransfer = async (arts, block) => {

    let art_idx = null, id = null;

    Mutation(qSelect('#inv_doll_stats'), () => arts = getArtsFromPage());

    const div = qSelect('.filter_tabs_block');

    const c1 = 'filter_tab_for_hover';
    const c2 = 'filter_tab_active';

    div.insertAdjacentHTML('beforeend', `<div id=mtrans_btn hint="mtrans" title="Мультипередача артефактов" style="background:url(${chrome.extension.getURL('img/inv_mtrans.png')}) no-repeat, #fff" class="filter_tab ${c1}"></div>`);

    const button = qSelect('#mtrans_btn');

    const storage = await getStorage();
    const translist = storage[userID + "_translist"] || {};

    setMTransferBadges(arts, translist, block);
    Mutation(block, () => {
        const cat = getCurrentCat();
        if (cat == 'mtrans') return;
        setMTransferBadges(arts, translist, block);
    });

    const friendslist = await getFriendsList();

    addListener(button, 'click', () => {

        const active_tab = qSelect(`.${c2}`);
        if (active_tab == button) return; // защита от повторных нажатий на активную кнопку мультипередач

        // проверяем на случай если выбрана категория по слотам, активного таба нет
        if (active_tab) active_tab.classList.replace(c2, c1); // меняем стиль активного таба на неактивный

        button.classList.replace(c1, c2); // присваиваем кнопке активный стиль

        qSelect('#return_all_rents').style.display = 'none'; //убираем кнопку возврата артефактов

        MTPanel(arts, block, friendslist, translist);
        usedArts(arts);
    });

    addListener(block, 'dragstart', e => {
        let target = e.target;
        while (!(art_idx = target.getAttribute('art_idx'))) target = target.parentNode;
        id = arts[art_idx][0];
        if (arts[art_idx][23] !== 0 && !(id in translist)) button.classList.add('mtrans-btn-anim');
    });

    addListener(button, 'dragover', e => {
        // если артефакт доступен для передач и не находится уже в списке мультипередач, то позволяем его добавить
        if (arts[art_idx][23] !== 0 && !(id in translist)) e.preventDefault();
    });

    addListener(document, 'dragend', e => {
        button.classList.remove('mtrans-btn-anim');
    });

    addListener(div, 'drop', e => {
        button.classList.remove('mtrans-btn-anim');
    });

    addListener(button, 'drop', e => {
        translist[id] = 0;
        setStorage({ [userID + "_translist"]: translist });
        setMTransferBadges(arts, translist, block);
    });

    // получена инструкция принудительного перехода на вкладку мултипередач
    if (sessionStorage.getItem('redirect')) {
        sessionStorage.removeItem('redirect');
        button.click();
    }
}


const setMTransferBadges = (arts, translist, block) => {
    for (let id in translist) {
        const art_idx = getIndex(arts, id);
        const art_div = qSelect(`[art_idx="${art_idx}"]`, block);
        art_div && art_div.classList.add('mtrans-badge');
    }
}


// Отображение содержимого вкладки Мультипередачи артефактов
const MTPanel = async (arts, block, friendslist, translist) => {

    let pool = {
        'arts': {
            /* id: {
               name: '',
               ppb: 0,
               dur1: 0,
               dur2: 0,
               summ: 0,
              }*/
        },
        selected: [],
        days: 0,
        hours: 0,
        battles: 0,
        renter: ''
    };


    let html = '';

    html += '<div class="mtrans-container">';
    html += `<div class="mtrans-header"><div id="art-name"></div>`;
    html += '<br>Стоимость боя <input onkeypress="return /\\d/.test(event.key)" id="ppb" type="text" maxlength="4" size="4" placeholder="0">';
    html += `<br><br><button id=btn_save>Сохранить значение</button><br><br><button id=btn_remove>Убрать артефакт</button>`;
    html += '</div><div class="mtrans-arts thin-scrollbar">';

    // сортируем артефакты по расположению как в инвентаре
    const sorted = Object.keys(translist).sort((id1, id2) => getIndex(arts, id1) - getIndex(arts, id2));

    for (let id of sorted) {

        const art_idx = getIndex(arts, id);
        // пропуск - сохраненного арта (надет, выброшен, сдан в аренду, в кузнице и т.п.)
        if (art_idx == -1 || arts[art_idx][12] != 0 || arts[art_idx][20] == 1) continue;

        const name = arts[art_idx][3]
        const dur1 = arts[art_idx][5];
        const dur2 = arts[art_idx][6];

        const html_src = arts[art_idx][7];
        const img = /artifacts\/((?:\w+\/)*[\w-]+)/.exec(html_src)[1]; // вытаскиваем картинку

        const suffix = arts[art_idx][8]; // содержит информацию о крафте
        const craftHTML = parseSuffix(suffix);

        pool['arts'][id] = {};
        pool['arts'][id].name = name + suffix;
        pool['arts'][id].ppb = translist[id];
        pool['arts'][id].dur1 = dur1;
        pool['arts'][id].dur2 = dur2;

        html += `<div class="inventory_item_div mtrans-item" data-id=${id} art_idx=${art_idx}>`;
        html += `<div class="mtrans-dur">${dur1}/${dur2}</div>`;
        html += `<input type="checkbox" class="mtrans-chk">`;
        html += `<img src="${IMG_LINK}art_fon_100x100.png" height=100%>`;
        html += `<img src="${IMG_LINK}artifacts/${img}.png" height=100% class="cre_mon_image2">`;
        html += `<div class="art_mods no-events">${craftHTML}</div></div>`;
    }

    html += '</div><div class="mtrans-footer">';
    html += `<select style="width:100%" id="friends"><option selected disabled>Выбрать получателя из друзей</option>${friendslist}</select><br>`;
    html += `Получатель <input id=renter type=text style="width:155px" value=""><br>Передать с возвратом через:<br>`;
    html += `<input onkeypress="return /\\d|\\./.test(event.key)" style="width:42px" id=hours type=text maxlength="3" placeholder="0"> часов`;
    html += ' <input onkeypress="return /\\d/.test(event.key)" style="width:42px" id=days type=text maxlength="3" placeholder="0"> дней';
    html += ' <input onkeypress="return /\\d/.test(event.key)" style="width:24px" id=bcount type=text maxlength="2" placeholder="0"> боёв<br>';
    html += 'Общая стоимость: <span id=summ>0</span><br>Общая комиссия: <span id=comm>0</span>';
    html += '<button id=btn_transfer>Передать</button></div>';
    html += '<div id=pool class=mtrans-pool></div></div><progress class=mtrans-pbar max="100" value="0"></progress><div id=mtrans-error></div>';

    block.innerHTML = html;

    const renter_input = qSelect('#renter');
    const bcount_input = qSelect('#bcount');
    const days_input = qSelect('#days');
    const hours_input = qSelect('#hours');
    const btn_transfer = qSelect('#btn_transfer');

    let currentItem = qSelect('.mtrans-item');

    // вытаскиваем параметры из сессии и присваиваем значения
    const session_plname = sessionStorage.getItem('pl_name');
    if (session_plname) pool.renter = renter_input.value = session_plname;


    const session_mtrans = sessionStorage.getItem('mtrans');
    if (session_mtrans) {
        const data = JSON.parse(session_mtrans);

        if (!session_plname) pool.renter = renter_input.value = data.renter;

        pool.battles = data.battles;
        bcount_input.value = pool.battles === 0 ? '' : pool.battles;

        pool.days = data.days;
        days_input.value = pool.days === 0 ? '' : pool.days;

        pool.hours = data.hours;
        hours_input.value = pool.hours === 0 ? '' : pool.hours;

        pool.selected = data.selected;

        // проставляем галочки на выбранных артах
        for (let id of pool.selected) {
            // Если арт был выброшен или куда-то передан будучи в списке мультипередачи, то убираем его
            if (id in pool.arts) {
                qSelect(`[data-id="${id}"]`).firstChild.nextSibling.checked = true;
            } else {
                pool.selected = pool.selected.filter(i => i != id);
            }
        }
    }


    showPool(pool, currentItem);
    poolToSession(pool);

    setSelected(pool, currentItem); // делаем выделенным первый артефакт в списке
    checkTransEnable(pool, btn_transfer);
    checkBattlesCount(pool);


    addListener(btn_transfer, 'click', e => {
        e.target.disabled = true;
        transferPool(pool);
    });

    addListener(qSelect('.mtrans-arts'), 'click', e => {

        // клик по иконке арта
        if (e.target.tagName == 'IMG') {
            currentItem = e.target.parentNode;
            setSelected(pool, currentItem);
            showPool(pool, currentItem);
        }

        // клик по чекбоксу
        if (e.target.tagName == 'INPUT') {
            const id = e.target.parentNode.dataset.id;

            if (e.target.checked) {
                pool.selected.push(id);
            } else {
                pool.selected = pool.selected.filter(i => i != id);
            }

            currentItem = e.target.parentNode;

            setSelected(pool, currentItem);
            showPool(pool, currentItem);
            poolToSession(pool);

            checkTransEnable(pool, btn_transfer);
            checkBattlesCount(pool);
        }
    });

    // ввод цены за бой и запись в базу
    addListener(qSelect('#btn_save'), 'click', async () => {
        const id = currentItem.dataset.id;
        pool.arts[id].ppb = translist[id] = +qSelect('#ppb').value;

        setStorage({ [userID + "_translist"]: translist });

        showPool(pool, currentItem);
        poolToSession(pool);

        checkPPB(pool, id);
        checkTransEnable(pool, btn_transfer);
    });

    // нажатие на кнопку, чтобы убрать артефакт из списка
    addListener(qSelect('#btn_remove'), 'click', async () => {
        const id = currentItem.dataset.id
        delete translist[id];
        delete pool.arts[id];
        pool.selected = pool.selected.filter(i => i != id);

        currentItem.remove();

        setStorage({ [userID + "_translist"]: translist });

        currentItem = qSelect('.mtrans-item');
        setSelected(pool, currentItem);

        showPool(pool, currentItem);
        poolToSession(pool);
        checkTransEnable(pool, btn_transfer);
    });

    addListener(renter_input, 'input', e => {
        pool.renter = e.target.value.trim();
        poolToSession(pool);
        checkTransEnable(pool, btn_transfer);
    });

    addListener(qSelect('#friends'), 'change', e => {
        pool.renter = renter_input.value = e.target.value;
        poolToSession(pool);
        checkTransEnable(pool, btn_transfer);
    });

    addListener(days_input, 'input', e => {
        let days = +days_input.value;
        if (days > 365) days = 365;
        const hours = days * 24;

        hours_input.value = hours;
        pool.hours = hours;
        pool.days = days;
        poolToSession(pool);
        checkTransEnable(pool, btn_transfer);
    });

    addListener(hours_input, 'input', e => {
        const hours = +hours_input.value;
        if (isNaN(hours) || hours < 0.1) return;
        const days = (hours / 24).toFixed(3);

        days_input.value = days;
        pool.hours = hours;
        pool.days = days;
        poolToSession(pool);
        checkTransEnable(pool, btn_transfer);
    });

    addListener(bcount_input, 'input', e => {
        pool.battles = +e.target.value;

        showPool(pool, currentItem);
        poolToSession(pool);
        checkTransEnable(pool, btn_transfer);
        checkBattlesCount(pool);
        if (currentItem) checkPPB(pool, currentItem.dataset.id);
    });
}


// преобразуем суффикс артефакта в набор картинок
const parseSuffix = suffix => {

    let html = '';
    const data = [...suffix.matchAll(/\w\d+/g)].flatMap(i => i);

    for (let craft of data) {
        html += `<img src="${IMG_LINK}mods_png/24/${craft}.png">`;
    }

    return html;
}


// сохраняем текущий пул в сессию
const poolToSession = p => sessionStorage.setItem('mtrans', JSON.stringify(p));


// проверка артов на доступную прочку для заданного количества боёв
const checkBattlesCount = pool => {
    for (let id in pool.arts) {
        const checkbox = qSelect(`[data-id="${id}"]`).firstChild;
        // если прочка выбранного арта меньше чем количество боёв, подсвечиваем красным прочку
        if (pool.arts[id].dur1 < pool.battles && pool.selected.includes(id)) {
            checkbox.classList.add('dur-warn');
        } else {
            checkbox.classList.remove('dur-warn');
        }
    }
}


// проверка цены за бой
const checkPPB = (pool, id) => {
    const ppb_input = qSelect('#ppb');

    if (pool.battles > 0 && pool.arts[id].ppb == 0 && pool.selected.includes(id)) {
        ppb_input.classList.add('ppb-warn');
    } else {
        ppb_input.classList.remove('ppb-warn');
    }
}


// проверка доступности кнопки отправки
const checkTransEnable = (pool, btn_transfer) => {
    let zeroPPB = false;

    if (pool.battles > 0) {
        for (let id of pool.selected) {
            if (pool.arts[id].ppb == 0) {
                zeroPPB = true;
                break;
            }
        }
    }

    btn_transfer.disabled = pool.selected.length == 0 || pool.days === 0 || !pool.renter || zeroPPB;
}


// Конвертируем никнейм игрока в windows-1251 (подсмотрена идея у xo4yxa)
const urlencode = str => {
    const ret = [];
    for (let i = 0; i < str.length; i++) {
        let n = str.charCodeAt(i);
        if (n >= 1040 && n <= 1103) n -= 848;
        if (n == 1025) n = 168;
        if (n == 1105) n = 184;
        ret.push(n);
    }
    return escape(String.fromCharCode(...ret));
}


// Передача артефактов
const transferPool = async pool => {

    const error_div = qSelect('#mtrans-error');
    const bar = qSelect('.mtrans-pbar');
    bar.style.display = 'block';
    error_div.innerHTML = '<br>';

    const sign = /sign='(\w+)/.exec(DATA)[1];

    const chunk = 100 / pool.selected.length; // размер куска для прибавки на прогрессбаре - зависит от количества артефактов
    let error = false;

    for (let id of pool.selected) {
        const response = await fetch('art_transfer.php', {
            method: 'POST',
            redirect: 'manual',
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `id=${id}&nick=${urlencode(pool.renter)}&gold=${pool.arts[id].summ}&sendtype=2&dtime=${pool.days}&bcount=${pool.battles}&rep_price=0&art_id=&sign=${sign}`
        });

        // передачи заблокированы принимающей стороной (при успешной передаче происходит редирект)
        if (response.ok) {
            bar.style.display = 'none';

            const data = await pageDecoder(response);
            const xmlDoc = new DOMParser().parseFromString(data, "text/html");
            const html = qSelect('td>font', xmlDoc);
            error_div.append(html);

            qSelect('#btn_transfer').disabled = false;
            error = true;
            break;
        }

        bar.value += chunk;
    }

    if (!error) {
        sessionStorage.clear();
        sessionStorage.setItem('redirect', true);
        location.reload();
    }
}


// отрисовка пула передаваемых артов
const showPool = (pool, currentItem) => {

    let html = '<div class="pool-element pool-header"><div>Артефакт</div><div>Сумма</div><div>Комиссия</div></div><div class="mtrans-poolarts thin-scrollbar">';
    let i = 1, total_summ = 0, total_comm = 0;

    for (let id of pool.selected) {

        const name = pool.arts[id].name;
        const dur1 = pool.arts[id].dur1;
        const dur2 = pool.arts[id].dur2;
        const ppb = pool.arts[id].ppb;

        let summ = ppb * (pool.battles > dur1 ? dur1 : pool.battles);
        let comm = Math.round(summ / 100); // комиссия
        if (summ < 50 && summ > 0) comm = 1;

        total_summ += summ, total_comm += comm;
        html += `<div class="pool-element${currentItem.dataset.id == id ? ' pool-selected' : ''}"><div>${i}. ${name} [${dur1}/${dur2}]</div><div>${summ}</div><div>${comm}</div></div>`;
        i++;

        pool.arts[id].summ = summ;
    }

    html += '</div>';

    qSelect('#pool').innerHTML = html;
    qSelect('#summ').textContent = total_summ;
    qSelect('#comm').textContent = total_comm;
}


// выбор артефакта в панели передач
const setSelected = (pool, currentItem) => {

    const ppb_input = qSelect('#ppb');
    const name_div = qSelect('#art-name');
    const btn_remove = qSelect('#btn_remove');
    const btn_save = qSelect('#btn_save');

    // если нет ни одного добавленного в панель артефакта
    if (!currentItem) {
        name_div.textContent = 'Перетащите на эту вкладку несколько артефактов';
        ppb_input.value = 0;
        ppb_input.disabled = btn_remove.disabled = btn_save.disabled = true;
        return;
    }

    const c = 'mtrans-selected';
    const selected = qSelect(`.${c}`);
    if (selected) selected.classList.remove(c);
    currentItem.classList.add(c);

    const id = currentItem.dataset.id;

    checkPPB(pool, id);

    name_div.textContent = `${pool.arts[id].name} [${pool.arts[id].dur1}/${pool.arts[id].dur2}]`;
    ppb_input.value = pool.arts[id].ppb;
}

const getIndex = (arts, id) => {
    const index = Object.keys(arts).find(key => arts[key][0] == id);
    return index || -1;
}

// сортировка объекта по содержимому массивов, возвращается массив
const sortObject = obj => Object.entries(obj).sort(([, v1], [, v2]) => v1[0].localeCompare(v2[0]));

// отслеживаем изменения в блоке инвентаря
const Mutation = (elem, response) => new MutationObserver(response).observe(elem, { childList: true, subtree: true });