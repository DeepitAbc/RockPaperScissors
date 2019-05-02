
web3.eth.getFirstAccountPromise = function () {

    // https://gist.github.com/xavierlepretre/ed82f210df0f9300493d5ca79893806a
    return web3.eth.getAccountsPromise()
        .then(function (accounts) {
            if (accounts.length > 0) {
                return accounts[0];
            } else if (typeof(mist) !== "undefined") {
                // https://gist.github.com/xavierlepretre/ee456323b2544dd4da22cd5fa6d2894c
                return mist.requestAccountPromise();
            } else {
                throw "No account found";
            }
        });
};
