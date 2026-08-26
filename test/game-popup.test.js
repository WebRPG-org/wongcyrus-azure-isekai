const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const pluginSource = fs.readFileSync(
  path.join(__dirname, '../js/plugins/NpcK8sPluginCommand.js'),
  'utf8',
);

function runGradingResponse(gradingResponse) {
  const responses = [
    {
      status: 'OK',
      next_game_phrase: 'TASK_ASSIGNED',
      task_name: 'ExampleTask',
    },
    gradingResponse,
  ];
  const openedUrls = [];

  function GameInterpreter() {}
  GameInterpreter.prototype.pluginCommand = function () {};

  class XMLHttpRequestMock {
    open() {}

    send() {
      this.status = 200;
      this.readyState = 4;
      this.response = JSON.stringify(responses.shift());
      this.onreadystatechange();
    }
  }

  const context = {
    Game_Interpreter: GameInterpreter,
    URLSearchParams,
    XMLHttpRequest: XMLHttpRequestMock,
    alert() {},
    console: { error() {}, log() {} },
    window: {
      focus() {},
      location: { search: '' },
      open(url) {
        openedUrls.push(url);
        return { closed: false };
      },
    },
    $gameMessage: { add() {}, clear() {} },
  };

  vm.runInNewContext(pluginSource, context);
  const interpreter = new context.Game_Interpreter();
  interpreter.pluginCommand('NpcK8sPluginCommand', ['Stella']);
  interpreter.pluginCommand('NpcK8sPluginCommand', ['Stella']);

  return openedUrls;
}

test('successful grading opens the Easter egg once', () => {
  const openedUrls = runGradingResponse({
    status: 'OK',
    next_game_phrase: 'READY_FOR_NEXT',
    task_completed: true,
    easter_egg_url: 'https://example.test/pass',
  });

  assert.deepEqual(openedUrls, ['https://example.test/pass']);
});

test('failed grading automatically opens the Easter egg and diagnostic report', () => {
  const openedUrls = runGradingResponse({
    status: 'OK',
    next_game_phrase: 'TASK_ASSIGNED',
    task_completed: false,
    easter_egg_url: 'https://example.test/fail',
    additional_data: {
      testResults: { ExampleTest: 0 },
      passedTests: 0,
      totalTests: 1,
      testResultXmlUrl: 'https://example.test/report.xml',
    },
  });

  assert.deepEqual(openedUrls, [
    'https://example.test/fail',
    'https://example.test/report.xml',
  ]);
});
