chrome.storage.local.get(null, storage => {
    // Принудительный редирект, в случае отключенной рулетки либо таверны
    const userID = storage.userID;
    if ((/roulette/.test(location.href) && !storage[userID + "_rulette"]) || (/tavern/.test(location.href) && !storage[userID + "_tavern"])) location = 'home.php';
    // Прячем строку с кнопками меню, если отключена хотя бы одна кнопка (для плавного появления позже)
    if ((!storage[userID + "_rulette"] || !storage[userID + "_chat"] || !storage[userID + "_tavern"]) && storage.login) {
        let style = document.createElement('style');
        style.innerHTML = `[style*="t_bkg"]>tbody, [class*="mm_item "], [class*="map_moving"]{opacity:0;transition:all 0.1s ease-out;}`;
        document.head.appendChild(style);
    }
});