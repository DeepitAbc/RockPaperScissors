
getEventsPromise= function (myFilter, count, timeOut) {
    timeOut = timeOut ? timeOut : 30000;

    var promise = new Promise(function (resolve, reject) {
        count = (typeof count !== "undefined") ? count : 1;
        var results = [];
        var toClear = setTimeout(function () {
            reject("Timed out");

        }, timeOut);

        myFilter.watch(function (error, result) {
            if (error) {
                clearTimeout(toClear);
                reject(error);
            } else {
                count--;
                results.push(result);
            }

            if (count <= 0) {
                resolve(results.map(value => value));
                clearTimeout(toClear);
                myFilter.stopWatching(() => {});
            }
        });

        if (count == 0) {
            promise = promise
                .then(function (events) {
                    throw "Expected to have no event";
                })

                .catch(function (error) {
                    if (error != "Timed out") {
                        throw error;
                    }
                });
        }
        return promise;
    });
};
