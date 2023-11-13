const _SAVE = 'Сохраняю. Пожалуйста, подождите.';
const _LOAD = 'Загружаю. Пожалуйста, подождите.';
const CSL = chrome.storage.local;
const CR = chrome.runtime;
const CT = chrome.tabs;

const EX_IM_OPTIONS = {
    // разрешенный тип файлов
    types: [
        {
            description: 'Файл настроек HWM Tool (*.hwm)',
            accept: {
                'text/json': '.hwm'
            }
        }
    ],
    excludeAcceptAllOption: true
}

const getElem = elem => document.getElementById(elem);
const addListener = (elem, action, callback) => elem.addEventListener(action, callback);
const Reset = () => location.reload();
const setStorage = obj => CSL.set(obj);

const MAIN_ = getElem('main');
const PAGEHOLDER_ = getElem('pageholder');
const PAGE1_ = getElem('page1');
const PAGE2_ = getElem('page2');

const LOGO_ = getElem('logo');

const TAVERN_ = getElem('tavern');
const RULETTE_ = getElem('rulette');
const CHAT_ = getElem('chat');
const INFORMATOR_ = getElem('informator');
const COLOR_ = getElem('color');
const BATTLEALERT_ = getElem('battlealert');
const SOUND_ = getElem('sound');

const TRADEHELP_ = getElem('tradehelp');
const TRADETIME_ = getElem('tradetime');
const BTN_EXTOPTS_ = getElem('btn_ExtOpts');
const CBX_EXTMARKETFILTER_ = getElem('ext_marketfilter');
const CBX_EXTSORT_ = getElem('ext_sort');
const SEL_EXTSORTTYPE_ = getElem('ext_sorttype');

const AUCBTNS_ = getElem('aucbtns');
const SMARTBG_ = getElem('smartbg');
const IFILTERS_ = getElem('ifilters');
const MTRANS_ = getElem('mtrans');

const FASTTRAVEL_ = getElem('fasttravel');
const PROTOCOL_ = getElem('protocol');
const HTIMER_ = getElem('htimer');
const TTIMER_ = getElem('ttimer');

const GTIMERS_ = getElem('gtimers');
const GTPOS_ = getElem('gtpos');
const GTSTYLE_ = getElem('gtstyle');
const GOALERT_ = getElem('goAlert');
const GNALERT_ = getElem('gnAlert');
const GLALERT_ = getElem('glAlert');
const GVALERT_ = getElem('gvAlert');
const JOBSEEK_ = getElem('jobseek');
const CBX_GNBOT_ = getElem('cbx_gnBot');

const BUILDMASTER_ = getElem('buildmaster');
const BTN_SAVE_ = getElem('btn_save');
const BTN_LOAD_ = getElem('btn_load');
const BTN_DEL_ = getElem('btn_del');
const BUILD_NAME_ = getElem('build_name');
const BUILD_SEL_ = getElem('build_sel');
const STATUS_ = getElem('status');
const MESSAGE_ = getElem('message');

const BTN_YES = getElem('btn_yes');
const BTN_NO = getElem('btn_no');

const BTN_EXPORT_ = getElem('btn_export');
const BTN_IMPORT_ = getElem('btn_import');

const BTN_GALLERY_ = getElem('btn_gallery');
const BTN_PAGE1_ = getElem('btn_page1');
const BTN_PAGE2_ = getElem('btn_page2');
const BTN_HELP_ = getElem('btn_help');

const KEY_ = getElem('key');
const SENDKEY_ = getElem('sendkey');
const KEYBLOCK_ = getElem('keyblock');
const KEYERROR_ = getElem('keyerror');

let build_obj = {};
let tabID, userID, HOST;

LOGO_.innerText += ' ' + CR.getManifest().version;

const Run = storage => {

    userID = storage.userID;

    // Блокировка доступа
    if (storage.blocked) return MAIN_.innerHTML = '<p style=margin:10%;>Вам заблокирован доступ к расширению.</p>';

    if (!storage.login) {
        PAGE1_.disabled = PAGE2_.disabled = true;
        KEYBLOCK_.innerHTML = '';
        LOGO_.insertAdjacentHTML('beforeend', '<span class=err> offline</span>');
    }

    TAVERN_.checked = storage[userID + "_tavern"];
    RULETTE_.checked = storage[userID + "_rulette"];
    CHAT_.checked = storage[userID + "_chat"];

    INFORMATOR_.checked = storage[userID + "_informator"];
    COLOR_.value = storage[userID + "_color"];

    BATTLEALERT_.checked = storage[userID + "_battlealert"];
    SOUND_.checked = storage[userID + "_sound"];
    // Инвентарь
    AUCBTNS_.checked = storage[userID + "_aucbtns"];
    IFILTERS_.checked = storage[userID + "_ifilters"];
    SMARTBG_.checked = storage[userID + "_smartbg"];
    MTRANS_.checked = storage[userID + "_mtrans"];

    TRADEHELP_.checked = storage[userID + "_tradehelp"];
    CBX_EXTMARKETFILTER_.checked = storage[userID + "_extMarketFilter"];
    CBX_EXTSORT_.checked = storage[userID + "_extSort"];
    SEL_EXTSORTTYPE_.value = storage[userID + "_extSortType"];

    HTIMER_.checked = storage[userID + "_htimer"];
    TTIMER_.checked = storage[userID + "_ttimer"];
    FASTTRAVEL_.checked = storage[userID + "_fasttravel"];
    PROTOCOL_.checked = storage[userID + "_protocol"];

    GTIMERS_.checked = storage[userID + "_gtimers"];
    GTPOS_.value = storage[userID + "_gtpos"];
    GTSTYLE_.value = storage[userID + "_gtstyle"];
    GOALERT_.checked = storage[userID + "_goAlert"];
    GNALERT_.checked = storage[userID + "_gnAlert"];
    GLALERT_.checked = storage[userID + "_glAlert"];
    GVALERT_.checked = storage[userID + "_gvAlert"];
    JOBSEEK_.checked = storage[userID + "_jobseek"];
    CBX_GNBOT_.checked = storage[userID + "_gnBot"];

    build_obj = storage[userID + "_buildlist"];

    // Загружаем список билдов
    Object.keys(build_obj).forEach(build => {
        BUILD_SEL_.innerHTML += '<option' + ((build == storage[userID + "_build_current"]) ? ' selected ' : ' ') + `value="${build}">${build}</option>`;
    });

    if (storage.busystate == 'saving') {
        blockUI();
        STATUS_.innerHTML = _SAVE;
        STATUS_.className = 'work';
    } else if (storage.busystate == 'loading') {
        blockUI();
        STATUS_.innerHTML = _LOAD;
        STATUS_.className = 'work';
    } else {
        // Получаем текущую вкладку
        CT.query({ active: true, currentWindow: true }, tabs => {

            tabID = tabs[0].id;

            const tabsSet = chrome.extension.getBackgroundPage().tabsSet;
            // Если текущая вкладка не относится к игре, блокируем Мастер билдов, в обратном случае делаем запрос на проверку статуса.
            if (tabsSet.has(tabID)) {
                CR.sendMessage({ 'getstatus': true });
            } else {
                blockUI();
            }
        });
    }

    const key = storage[userID + "_key"];
    if (key) keyParser(key);

    TRADETIME_.value = storage[userID + "_tradetime"]; // обновляем значение таймера рынка после проверки ключа
}


/* Обработка функционала ключей */

const keyParser = key => {
    TRADETIME_.children[0].disabled = false;
    KEYBLOCK_.innerHTML = `<p class=work>ID ${userID} : key ${key}</p>`;
}


/* Обработка взаимодействия с интерфейсом */

addListener(SENDKEY_, 'click', () => {
    if (KEY_.value) {
        CR.sendMessage({ 'verifykey': KEY_.value });
        SENDKEY_.disabled = true;
    }
});

addListener(BTN_GALLERY_, 'click', () => {
    CT.create({ 'url': `${chrome.extension.getBackgroundPage().HOST}/photo_pl_albums.php` })
});

addListener(TAVERN_, 'change', () => save_options({ [userID + "_tavern"]: TAVERN_.checked }));
addListener(RULETTE_, 'change', () => save_options({ [userID + "_rulette"]: RULETTE_.checked }));
addListener(CHAT_, 'change', () => save_options({ [userID + "_chat"]: CHAT_.checked }));

addListener(INFORMATOR_, 'change', () => save_options({ [userID + "_informator"]: INFORMATOR_.checked }));
addListener(COLOR_, 'change', () => save_options({ [userID + "_color"]: COLOR_.value }));

addListener(BATTLEALERT_, 'change', () => save_options({ [userID + "_battlealert"]: BATTLEALERT_.checked }));
addListener(SOUND_, 'change', () => setStorage({ [userID + "_sound"]: SOUND_.checked }));

addListener(TRADEHELP_, 'change', () => save_options({ [userID + "_tradehelp"]: TRADEHELP_.checked }));
addListener(TRADETIME_, 'change', () => {
    setStorage({ [userID + "_tradetime"]: +TRADETIME_.value });
    CR.sendMessage({ 'tradetimer_relaunch': true, 'tradetime': TRADETIME_.value });
});
addListener(CBX_EXTMARKETFILTER_, 'change', () => save_options({ [userID + "_extMarketFilter"]: CBX_EXTMARKETFILTER_.checked }));
addListener(CBX_EXTSORT_, 'change', () => save_options({ [userID + "_extSort"]: CBX_EXTSORT_.checked },
    TRADEHELP_.checked ? { 'content': 'loc_replace_extSort', 'sort': SEL_EXTSORTTYPE_.value } : {}));
addListener(SEL_EXTSORTTYPE_, 'change', () => save_options({ [userID + "_extSortType"]: SEL_EXTSORTTYPE_.value },
    (TRADEHELP_.checked && CBX_EXTSORT_.checked) ? { 'content': 'loc_replace_extSort', 'sort': SEL_EXTSORTTYPE_.value } : {}));

// Инвентарь
addListener(AUCBTNS_, 'change', () => save_options({ [userID + "_aucbtns"]: AUCBTNS_.checked }));
addListener(IFILTERS_, 'change', () => save_options({ [userID + "_ifilters"]: IFILTERS_.checked }));
addListener(SMARTBG_, 'change', () => save_options({ [userID + "_smartbg"]: SMARTBG_.checked }));
addListener(MTRANS_, 'change', () => save_options({ [userID + "_mtrans"]: MTRANS_.checked }));

addListener(GTIMERS_, 'change', () => save_options({ [userID + "_gtimers"]: GTIMERS_.checked }));
addListener(GTPOS_, 'change', () => save_options({ [userID + "_gtpos"]: GTPOS_.value }));
addListener(GTSTYLE_, 'change', () => save_options({ [userID + "_gtstyle"]: GTSTYLE_.value }));
addListener(HTIMER_, 'change', () => save_options({ [userID + "_htimer"]: HTIMER_.checked }));
addListener(TTIMER_, 'change', () => save_options({ [userID + "_ttimer"]: TTIMER_.checked }, { 'content': 'loc_replace', 'url': 'map.php' }));
addListener(FASTTRAVEL_, 'change', () => save_options({ [userID + "_fasttravel"]: FASTTRAVEL_.checked }));
addListener(PROTOCOL_, 'change', () => save_options({ [userID + "_protocol"]: PROTOCOL_.checked }));

addListener(GOALERT_, 'change', () => save_options({ [userID + "_goAlert"]: GOALERT_.checked }));
addListener(GNALERT_, 'change', () => save_options({ [userID + "_gnAlert"]: GNALERT_.checked }));
addListener(GLALERT_, 'change', () => save_options({ [userID + "_glAlert"]: GLALERT_.checked }));
addListener(GVALERT_, 'change', () => save_options({ [userID + "_gvAlert"]: GVALERT_.checked }));
addListener(JOBSEEK_, 'change', () => save_options({ [userID + "_jobseek"]: JOBSEEK_.checked }));
addListener(CBX_GNBOT_, 'change', () => save_options({ [userID + "_gnBot"]: CBX_GNBOT_.checked }));


/* Мастер билдов */

BUILD_NAME_.onkeypress = e => /[^"]/.test(e.key); // фильтр для ввода названия билда
addListener(BUILD_SEL_, 'click', () => BUILD_NAME_.value = BUILD_SEL_.value);
addListener(BTN_NO, 'click', Reset);

// сохранение
addListener(BTN_SAVE_, 'click', () => {

    const name = BUILD_NAME_.value.trim();

    if (!name) {
        BUILD_NAME_.value = '';
        return;
    }

    // если такое название билда уже есть, то выдаем предупреждение
    if (name in build_obj) {

        STATUS_.className = 'err';
        MESSAGE_.textContent = `Перезаписать существующий билд "${name}"?`;
        blockBuildMaster();

        addListener(BTN_YES, 'click', () => saveBuild(name));

    } else {

        saveBuild(name);
    }
});

const saveBuild = name => {
    blockUI();
    STATUS_.innerHTML = _SAVE;
    STATUS_.className = 'work';

    setStorage({ [userID + "_build_current"]: name, busystate: 'saving' });
    CR.sendMessage({ 'savebuild': true, 'name': name });
}

// загрузка
addListener(BTN_LOAD_, 'click', () => {

    const name = BUILD_SEL_.value;

    if (!name) return;

    blockUI();
    STATUS_.innerHTML = _LOAD;
    STATUS_.className = 'work';

    setStorage({ [userID + "_build_current"]: name, busystate: 'loading' });
    CR.sendMessage({ 'loadbuild': true, 'name': name });
});

// удаление
addListener(BTN_DEL_, 'click', () => {

    const name = BUILD_SEL_.value;

    if (!name) return;

    STATUS_.className = 'err';
    MESSAGE_.textContent = `Удалить билд "${name}"?`;
    blockBuildMaster();

    addListener(BTN_YES, 'click', () => {
        delete build_obj[name];

        if (name == [userID + "_build_current"]) setStorage({ [userID + "_build_current"]: "" });

        setStorage({ [userID + "_buildlist"]: build_obj });

        Reset();
    });
});

const blockBuildMaster = () => BUILDMASTER_.disabled = true;
const blockUI = () => PAGE1_.disabled = PAGE2_.disabled = true


// ЭКСПОРТ \ ИМПОРТ НАСТРОЕК

addListener(BTN_EXPORT_, 'click', _ => {

    CSL.get(null, async storage => {

        const fileName = { suggestedName: `${storage.userID}.hwm` };

        const reg = RegExp(storage.userID);
        for (let key in storage) !reg.test(key) && delete storage[key];

        try {
            const fileHandle = await window.showSaveFilePicker({ ...fileName, ...EX_IM_OPTIONS });
            const writableStream = await fileHandle.createWritable();

            await writableStream.write(new Blob([JSON.stringify(storage)], { type: 'text/json' }));
            await writableStream.close();
        } catch { }

    });
});


addListener(BTN_IMPORT_, 'click', async _ => {

    try {
        const [fileHandle] = await window.showOpenFilePicker(EX_IM_OPTIONS);
        const file = await fileHandle.getFile();
        const fileContent = await file.text();

        const settings = JSON.parse(fileContent);

        CSL.get(null, storage => {
            const s = { ...storage, ...settings };

            PAGE1_.disabled = PAGE2_.disabled = true;
            setStorage(s);

            CR.sendMessage({ 'logout': true });
            CT.sendMessage(tabID, { 'content': 'loc_reload' });
        });

    } catch { }
});




// кнопка Страница1
addListener(BTN_PAGE1_, 'click', () => {
    BtnsUnselect();
    BTN_PAGE1_.classList.add('selected');
    PAGEHOLDER_.style = 'margin-left:0';
});

// кнопка Страница2
addListener(BTN_PAGE2_, 'click', () => {
    BtnsUnselect();
    BTN_PAGE2_.classList.add('selected');
    PAGEHOLDER_.style = 'margin-left:-300px';
});

// кнопка расширенных настроек
addListener(BTN_EXTOPTS_, 'click', () => {
    BtnsUnselect();
    PAGEHOLDER_.style = 'margin-left:-600px';
});

// кнопка помощи
addListener(BTN_HELP_, 'click', () => {
    BtnsUnselect();
    BTN_HELP_.classList.add('selected');
    PAGEHOLDER_.style = 'margin-left:-900px';
});


const BtnsUnselect = _ => {
    [BTN_HELP_, BTN_PAGE1_, BTN_PAGE2_].forEach(btn => {
        btn.classList.remove('selected');
    });
}


CR.onMessage.addListener(request => {

    if (request.popup == 'reload') Reset();

    // Блокируем "Мастер билдов", если нет соединения с интернетом или игрок находится в бою\заявке или перемещается
    if (request.pl_status && (/offline|^(?!otherfree)/.test(request.pl_status) || request.travel_status)) blockBuildMaster();


    if (request.popup == 'keyreject') {
        SENDKEY_.disabled = false;
        KEY_.value = '';
        KEYERROR_.innerHTML = 'Неверный ключ активации';
    }

    if (request.popup == 'keyaccept') {
        KEYBLOCK_.innerHTML = '<p class=work>Ваш ключ успешно активирован! Обновление данных...</p>'
        setTimeout(Reset, 3000);
    }
});


const save_options = (obj, params = { 'content': 'loc_reload' }) => {

    setStorage(obj);
    //перезагружаем content
    CT.sendMessage(tabID, params);
}


// Старт
addListener(document, 'DOMContentLoaded', () => CSL.get(null, storage => Run(storage)));