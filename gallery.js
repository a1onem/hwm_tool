/* (\\n\s+) применить эту регулярку после обфускации кода, чтобы убрать лишние пробелы и переносы строк 

arts key - id (art_info.php?id=id)
    value - [name, img_url(dcdn.heroeswm.ru/i/artifacts/[img_url].png), lvl, oa, place(1-shop only|2-market only|3-both)|cat, slot, set] 

mobs key - "Название"
    value - [hp, link(army_info.php?name=[link]), img_url(dcdn.heroeswm.ru/i/portraits/[img_url]anip40.png)]
*/

(() => {
    let a_iconW = 100, m_iconW = 144, m_iconH = 120;
    let a_amount = 80, m_amount = 45;
    let minOA = 0, maxOA = 20, minLVL = 1, maxLVL = 23, slot = 0, set = 0;
    let a_pagesdiv, m_pagesdiv;
    let a_selected = [], m_selected = [], a_found = 0, m_found = 0, a_searchtxt = '', m_searchtxt = '';
    let a_curpage = 1, m_curpage = 1, a_pagesTotal, m_pagesTotal, a_total, m_total, curgallery = 'arts';
    let mouseY, mouseX;
    const REGEXP = 'return /[а-яёa-z0-9\- ]/i.test(event.key)';
    const IMG_LINK = /lordswm/.test(location.origin) ? 'https://cfcdn.lordswm.com/i/' : 'https://dcdn.heroeswm.ru/i/';
    const NOTHING = 'Ничего не найдено.';

    document.title = 'HWM Tool. Галерея артефактов и существ';
    let center = document.querySelector('body > center');
    center.querySelectorAll('table').forEach(t => t.remove());
    center.innerHTML += '<div id="a_div" class="main"></div><div id="m_div" class="main"></div>';

    let base;
    // Загружаем базу
    chrome.runtime.sendMessage({ 'get_base': true }, response => {
        base = response.base;
        Init();
    });

    // Вспомогательные функции (для эффективного сжатия кода)
    const getElem = elem => document.getElementById(elem);
    const addListener = (elem, action, callback) => elem.addEventListener(action, callback);

    const Init = () => {

        a_total = Object.keys(base.arts).length;
        m_total = Object.keys(base.mobs).length;

        window.onbeforeunload = () => history.replaceState([curgallery, a_curpage, a_found, a_selected, a_iconW, a_amount, a_searchtxt, minLVL, maxLVL, minOA, maxOA, slot, set, m_curpage, m_found, m_selected, m_iconW, m_iconH, m_amount, m_searchtxt], "");

        document.onmousemove = e => { mouseY = e.clientY, mouseX = e.clientX; }

        addListener(document, 'click', e => {

            let old = document.querySelector('.art_info');
            old && old.remove();

            if (/a_p\d/.test(e.target.id)) {
                a_curpage = e.target.id.slice(3);
                a_pagesTotal = makePages(a_found, a_amount, a_pagesdiv, 'a_p', a_curpage);
                drawArts(a_curpage);
            }

            if (/m_p\d/.test(e.target.id)) {
                m_curpage = e.target.id.slice(3);
                m_pagesTotal = makePages(m_found, m_amount, m_pagesdiv, 'm_p', m_curpage);
                drawMobs(m_curpage);
            }

            if (/art_/.test(e.target.id)) {

                let div = document.createElement('div');
                div.className = 'art_info';

                let art = e.target.id.slice(4);

                let html = `<p><b>${base.arts[art][0]}</b></p><p>Уровень: <b>${base.arts[art][2]}</b><br>Очки амуниции: <b>${base.arts[art][3]}</b></p>
                <p><a href=art_info.php?id=${art}>Открыть полную информацию</a></p>`;

                let cat = base.arts[art][4];
                if (cat == null) html += '<i>Не продаётся.</i>';
                else if (!/reg.php/.test(document.body.innerHTML)) {
                    cat = cat.split('|');
                    if (/2|3/.test(cat[0])) html += `<p><a href='auction.php?cat=${cat[1]}&art_type=${cat[1] == 'part' ? 'part_' : ''}${art}&sort=204&sbn=0&sau=0&snew=0'>На рынке</a></p>`;
                    if (/1|3/.test(cat[0])) html += `<p><a href='shop.php?cat=${cat[1]}#${art}'>В магазине</a></p>`;
                }

                div.innerHTML = html;
                document.body.append(div);

                if (mouseY > window.innerHeight - div.clientHeight) {
                    div.style.top = mouseY + window.scrollY - div.clientHeight;
                } else {
                    div.style.top = mouseY + window.scrollY - div.clientHeight / 2;
                }

                div.style.left = mouseX + 80 - div.clientWidth / 2;
            }
        });

        mobsPrepare();
        artsPrepare();
    }

    const artsPrepare = () => {

        const html = `<div class="menu">
    <select id="a_base">
    <option value=arts>Артефакты (${a_total})</option>
    <option value=mobs>Существа (${m_total})</option>
    </select>&nbsp;
    Размер иконок: <select id="a_size">
    <option value=100>Средний</option>
    <option value=200>Большой</option>
    </select>&nbsp;
    Кол-во на страницу: <select id="a_amount">
    <option value=80>80</option>
    <option value=160>160</option>
    <option value=all>Все</option>
    </select>&nbsp;
    Поиск: <input id="a_search" list="a_list" maxlength="25" onkeypress="${REGEXP}">
    <datalist id="a_list"></datalist>
    <br><br>
    Уровень: <select id="minlvl"></select> - <select id="maxlvl"></select>&nbsp;
    ОА: <select id="minoa"></select> - <select id="maxoa"></select>&nbsp;
    Слот: <select id="slot">
    <option value=0>Все</option>
    <option value=1>Кольцо</option>
    <option value=2>Голова</option>
    <option value=3>Шея</option>
    <option value=4>Корпус</option>
    <option value=5>Спина</option>
    <option value=6>Правая рука</option>
    <option value=7>Ноги</option>
    <option value=8>Левая рука</option>
    <option value=9>Рюкзак</option>
    <option value=10>Другое</option>
    </select>&nbsp;
    Комплект: <select id=set>
    <option value=0>Все</option>
    <option value=1>Ученик</option>
    <option value=2>Охотник</option>
    <option value=3>Мастер-охотник</option>
    <option value=4>Великий охотник</option>
    <option value=5>Зверобой</option>
    <option value=43>Лес</option>
    <option value=6>Вор</option>
    <option value=7>Налётчик</option>
    <option value=8>Рейнджер</option>
    <option value=9>Тактик</option>
    <option value=10>Вербовщик</option>
    <option value=11>Наёмник-воин</option>
    <option value=12>Рыцарь-воин</option>
    <option value=13>Паладин</option>
    <option value=14>Некромант-ученик</option>
    <option value=15>Маг-ученик</option>
    <option value=16>Великий маг</option>
    <option value=17>Эльф-скаут</option>
    <option value=18>Эльф-воин</option>
    <option value=19>Друид</option>
    <option value=20>Варвар-воин</option>
    <option value=21>Слуга тьмы</option>
    <option value=22>Демон-воин</option>
    <option value=23>Гном-воин</option>
    <option value=24>Гном-мастер</option>
    <option value=25>Степной варвар</option>
    <option value=26>Непокорный варвар</option>
    <option value=27>Рыцарь солнца</option>
    <option value=28>Инквизитор</option>
    <option value=29>Амфибия</option>
    <option value=30>Сурвилург</option>
    <option value=31>Времена</option>
    <option value=32>Мироходец</option>
    <option value=33>Пират</option>
    <option value=34>Полководец</option>
    <option value=35>Подземелья</option>
    <option value=36>Разбойник</option>
    <option value=37>Империя</option>
    <option value=38>Тьма</option>
    <option value=39>Небеса</option>
    <option value=40>Океан</option>
    <option value=41>Авантюрист</option>
    <option value=42>Единство</option>
    <option value=44>Магма</option>
    <option value=45>Ловчий</option>
    <option value=46>Армада</option>
    <option value=47>Странник</option>
    <option value=48>Страх</option>
    <option style=background:#eee disabled></option>
    <option value=90>Акционка</option></select>
    <div id="a_pages" class="pages"></div></div>
    <div id="a_gallery"></div>`;

        let div = getElem('a_div');
        if (history.state) {
            if (history.state[0] == 'mobs') div.style.display = 'none';
        }
        div.innerHTML = html;

        const A_LIST = getElem('a_list');
        let lst = '';
        for (let art in base.arts) {
            lst += `<option value="${base.arts[art][0]}">`;
        }
        A_LIST.innerHTML = lst;

        const BASEBTN_ = getElem('a_base');
        const SIZEBTN_ = getElem('a_size');
        const AMOUNTBTN_ = getElem('a_amount');
        const MINOABTN_ = getElem('minoa');
        const MAXOABTN_ = getElem('maxoa');
        const MINLVLBTN_ = getElem('minlvl');
        const MAXLVLBTN_ = getElem('maxlvl');
        const SLOT_ = getElem('slot');
        const SET_ = getElem('set');
        const SEARCH_ = getElem('a_search');
        a_pagesdiv = getElem('a_pages');

        for (let i = 0; i <= maxOA; i++) {
            MINOABTN_.innerHTML = MAXOABTN_.innerHTML += `<option value=${i}>${i}</option>`
        }

        for (let i = 1; i <= maxLVL; i++) {
            MINLVLBTN_.innerHTML = MAXLVLBTN_.innerHTML += `<option value=${i}>${i}</option>`
        }

        MAXOABTN_.value = maxOA;
        MAXLVLBTN_.value = maxLVL;

        addListener(BASEBTN_, 'change', e => {
            if (e.target.value == 'mobs') {
                div.style.display = 'none';
                getElem('m_div').style.display = 'block';
                BASEBTN_.value = 'arts';
                curgallery = 'mobs';
            }
        });

        addListener(SIZEBTN_, 'change', e => {
            a_iconW = e.target.value;
            drawArts();
        });

        addListener(AMOUNTBTN_, 'change', e => {
            if (e.target.value == 'all') {
                a_amount = a_total;
            } else {
                a_amount = e.target.value;
            }
            selectArts();
        });

        addListener(MINOABTN_, 'change', e => {
            let value = +e.target.value;
            if (value > +MAXOABTN_.value) MAXOABTN_.value = maxOA = value;
            minOA = value;
            selectArts(a_total);
        });
        addListener(MAXOABTN_, 'change', e => {
            let value = +e.target.value;
            if (value < +MINOABTN_.value) MINOABTN_.value = minOA = value;
            maxOA = value;
            selectArts();
        });

        addListener(MINLVLBTN_, 'change', e => {
            let value = +e.target.value;
            if (value > +MAXLVLBTN_.value) MAXLVLBTN_.value = maxLVL = value;
            minLVL = value;
            selectArts();
        });
        addListener(MAXLVLBTN_, 'change', e => {
            let value = +e.target.value;
            if (value < +MINLVLBTN_.value) MINLVLBTN_.value = minLVL = value;
            maxLVL = value;
            selectArts();
        });

        addListener(SLOT_, 'change', e => {
            slot = e.target.value;
            selectArts();
        });

        addListener(SET_, 'change', e => {
            set = e.target.value;
            selectArts();
        });

        addListener(SEARCH_, 'keyup', e => {
            let txt = e.target.value.trim().toLowerCase();
            if (txt != a_searchtxt) {
                a_searchtxt = txt;
                selectArts();
            }
        });


        if (history.state) {

            let hs = history.state;

            curgallery = hs[0];
            a_curpage = hs[1];
            a_found = hs[2];
            a_selected = hs[3];
            a_iconW = SIZEBTN_.value = hs[4];
            a_amount = hs[5];
            AMOUNTBTN_.value = hs[5] == a_total ? 'all' : a_amount;
            a_searchtxt = SEARCH_.value = hs[6];
            minLVL = MINLVLBTN_.value = hs[7];
            maxLVL = MAXLVLBTN_.value = hs[8];
            minOA = MINOABTN_.value = hs[9];
            maxOA = MAXOABTN_.value = hs[10];
            slot = SLOT_.value = hs[11];
            set = SET_.value = hs[12]

            a_pagesTotal = makePages(a_found, a_amount, a_pagesdiv, 'a_p', a_curpage);
            drawArts(a_curpage);

        } else {
            selectArts();
        }
    }


    const mobsPrepare = () => {

        const html = `<div class="menu">
    <select id="m_base">
    <option value=mobs>Существа (${m_total})</option>
    <option value=arts>Артефакты (${a_total})</option>
    </select>&nbsp;
    Размер иконок: <select id="m_size">
    <option value=120>Средний</option>
    <option value=180>Большой</option>
    </select>&nbsp;
    Кол-во на страницу: <select id="m_amount">
    <option value=45>45</option>
    <option value=100>100</option>
    <option value=all>Все</option>
    </select>&nbsp;
    Поиск: <input id="m_search" list="m_list" maxlength="25" onkeypress="${REGEXP}">
    <datalist id="m_list"></datalist>
    <div id="m_pages" class="pages"></div></div>
    <div id="m_gallery"></div>`;

        let div = getElem('m_div');
        if (history.state) {
            if (history.state[0] == 'mobs') div.style.display = 'block';
        }
        div.innerHTML = html;

        const M_LIST = getElem('m_list');
        let lst = '';
        for (let mob in base.mobs) {
            lst += `<option value="${mob}">`;
        }
        M_LIST.innerHTML = lst;

        const BASEBTN_ = getElem('m_base');
        const SIZEBTN_ = getElem('m_size');
        const AMOUNTBTN_ = getElem('m_amount');
        const SEARCH_ = getElem('m_search');

        m_pagesdiv = getElem('m_pages');

        addListener(BASEBTN_, 'change', e => {
            if (e.target.value == 'arts') {
                getElem('a_div').style.display = 'block';
                div.style.display = 'none';
                BASEBTN_.value = 'mobs';
                curgallery = 'arts';
            }
        });

        addListener(SIZEBTN_, 'change', e => {
            m_iconH = e.target.value;
            m_iconW = m_iconH / 60 * 72;
            drawMobs();
        });

        addListener(AMOUNTBTN_, 'change', e => {
            if (e.target.value == 'all') {
                m_amount = m_total;
            } else {
                m_amount = e.target.value;
            }
            selectMobs();
        });

        addListener(SEARCH_, 'keyup', e => {
            let txt = e.target.value.trim().toLowerCase();
            if (txt != m_searchtxt) {
                m_searchtxt = txt;
                selectMobs();
            }
        });


        if (history.state) {

            let hs = history.state;

            m_curpage = hs[13];
            m_found = hs[14];
            m_selected = hs[15];
            m_iconW = hs[16];
            m_iconH = SIZEBTN_.value = hs[17];
            m_amount = hs[18];
            AMOUNTBTN_.value = hs[18] == m_total ? 'all' : m_amount;
            m_searchtxt = SEARCH_.value = hs[19];

            m_pagesTotal = makePages(m_found, m_amount, m_pagesdiv, 'm_p', m_curpage);
            drawMobs(m_curpage);

        } else {
            selectMobs();
        }
    }


    // Отрисовка номеров страниц
    const makePages = (found, amount, pagesdiv, id, curpage) => {
        let pagesTotal = Math.ceil(found / amount);
        pagesdiv.innerHTML = '';
        for (let i = 1; i <= pagesTotal; i++) {
            pagesdiv.innerHTML += `<a id='${id}${i}' href='javascript:void(0)' ${i == curpage ? 'style="background: #bbbbaf; pointer-events: none;"' : ''}>${i}</a>`;
        }
        return pagesTotal;
    }


    // Находим арты, удовлетворяющие запросам
    const selectArts = () => {

        a_curpage = 1;
        a_found = 0;
        a_selected = [];
        const arts = Object.keys(base.arts);

        for (let i = 0; i < a_total; i++) {

            const art = arts[i];
            const name = base.arts[art][0].toLowerCase();
            const lvl = base.arts[art][2];
            const base_oa = base.arts[art][3];
            const base_slot = base.arts[art][5];
            const base_set = base.arts[art][6];

            if (lvl >= minLVL && lvl <= maxLVL && base_oa >= minOA && base_oa <= maxOA && (slot >= 1 ? base_slot == slot : true) && (set >= 1 ? base_set == set : true) && (a_searchtxt != '' ? (name.search(a_searchtxt) == -1 ? false : true) : true)) {
                a_found++;
                a_selected.push(art);
            }
            if (i == a_total - 1) {
                a_pagesTotal = makePages(a_found, a_amount, a_pagesdiv, 'a_p', a_curpage);
                drawArts();
            }
        }
    }

    const selectMobs = () => {

        m_curpage = 1;
        m_found = 0;
        m_selected = [];
        let mobs = Object.keys(base.mobs);

        for (let i = 0; i < m_total; i++) {

            let name = mobs[i];

            if (m_searchtxt != '' ? (name.toLowerCase().search(m_searchtxt) == -1 ? false : true) : true) {
                m_found++;
                m_selected.push(name);
            }
            if (i == m_total - 1) {
                m_pagesTotal = makePages(m_found, m_amount, m_pagesdiv, 'm_p', m_curpage);
                drawMobs();
            }
        }
    }

    // Выводим на экран арты
    const drawArts = () => {

        const a_gallery = getElem('a_gallery');
        a_gallery.innerHTML = '';

        if (a_selected.length > 0) {
            let end;
            let j = a_amount * a_curpage;

            if (a_curpage == a_pagesTotal) {
                end = a_selected.length;
            } else {
                end = j;
            }

            let html = '';

            for (let i = j - a_amount; i < end; i++) {

                let art = a_selected[i];
                let name = base.arts[art][0];
                let img = base.arts[art][1];
                // Фон иконки
                let bg = `art_fon_${a_iconW}x${a_iconW}.png`;
                // Новогодний фон - не используется
                /*if (/#/.test(img)) {
                    bg = `art_ny_fon_${a_iconW}x${a_iconW}.png`;
                    img = img.replace('#', '');
                }*/

                /\/$/.test(img) && (img += art); // Если ссылка содержит только каталог, дописываем арт
                // Если ссылка на картинку есть, используем её, если нет - берем ссылку арта
                let imgurl = `${IMG_LINK}artifacts/${img || art}${a_iconW == 200 ? '_b' : ''}.png`;
                let lvl = base.arts[art][2];
                let pts = base.arts[art][3];

                html += `<div title='${name}\nУровень: ${lvl}\nОчки амуниции: ${pts}' class='icon' style='background: url(${IMG_LINK + bg});background-size: cover;margin:${(a_iconW / 26) | 0}'>
                        <img src='${imgurl}' id='art_${art}' width='${a_iconW}'/></div>`;
            }

            a_gallery.insertAdjacentHTML('afterbegin', html);

        } else {
            a_pagesdiv.innerHTML = NOTHING;
        }
    }

    const drawMobs = () => {

        const m_gallery = getElem('m_gallery');
        m_gallery.innerHTML = '';

        if (m_selected.length > 0) {
            let end;
            let j = m_amount * m_curpage;

            if (m_curpage == m_pagesTotal) {
                end = m_selected.length;
            } else {
                end = j;
            }

            let html = '';

            for (let i = j - m_amount; i < end; i++) {

                let name = m_selected[i];
                let hp = base.mobs[name][0];
                let link1 = base.mobs[name][1];
                let link2 = base.mobs[name][2];

                let mob = link2 ? link2 : link1;

                let imgurl = `${IMG_LINK}portraits/${mob}anip${m_iconH / 3}.png`;

                html += `<a href="army_info.php?name=${link1}" title='${name}\nЕд. жизни: ${hp}' class='icon m_icon' style='margin:${m_iconW / 20 | 0}'>
                        <img src='${imgurl}' width='${m_iconW}' height='${m_iconH}'/></a>`;
            }

            m_gallery.insertAdjacentHTML('afterbegin', html);

        } else {
            m_pagesdiv.innerHTML = NOTHING;
        }
    }

})();