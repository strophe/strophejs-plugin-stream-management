require.config({
    baseUrl: '../',
    paths: {
        "strophe":          "node_modules/strophe.js/dist/strophe.umd",
        "websocket":        "node_modules/mock-socket/dist/mock-socket",
        "streammanagement": "lib/strophe.stream-management",

        // Tests
        "jquery":           "node_modules/jquery/dist/jquery",
        "tests":            "tests/tests"
    }
});

require(["tests", "strophe.js", "websocket", "streammanagement"], function (tests, Strophe, mockWebsocket) {
    QUnit.done(function (details) {
        console.log("Total: "+details.total+" Failed: "+details.failed+" Passed: "+details.passed+" Runtime: "+details.runtime);
        console.log("All tests completed!");
    });

    QUnit.testDone(function (details) {
        var result = {
            "Module name": details.module,
            "Test name": details.name,
            "Assertions": {
                "Total": details.total,
                "Passed": details.passed,
                "Failed": details.failed
            },
            "Skipped": details.skipped,
            "Todo": details.todo,
            "Runtime": details.runtime
        };
        console.log(JSON.stringify(result, null, 2));
    });

    QUnit.start();
    QUnit.begin(function (details) {
        tests.run();
    });
});
