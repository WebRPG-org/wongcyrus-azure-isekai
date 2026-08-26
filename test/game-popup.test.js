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
  const reportUrls = [];
  const elements = new Map();

  function createElement(tagName) {
    return {
      addEventListener() {},
      appendChild(child) {
        child.parentNode = this;
        if (child.href) {
          reportUrls.push(child.href);
        }
      },
      parentNode: null,
      removeChild(child) {
        elements.delete(child.id);
      },
      style: {},
      tagName,
    };
  }

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
    document: {
      body: {
        appendChild(element) {
          element.parentNode = this;
          elements.set(element.id, element);
        },
        removeChild(element) {
          elements.delete(element.id);
        },
      },
      createElement,
      getElementById(id) {
        return elements.get(id) || null;
      },
    },
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

  return { openedUrls, reportUrls };
}

test('successful grading opens the Easter egg once', () => {
  const result = runGradingResponse({
    status: 'OK',
    next_game_phrase: 'READY_FOR_NEXT',
    task_completed: true,
    easter_egg_url: 'https://example.test/pass',
  });

  assert.deepEqual(result.openedUrls, ['https://example.test/pass']);
  assert.deepEqual(result.reportUrls, []);
});

test('failed grading opens the Easter egg and exposes the diagnostic report link', () => {
  const result = runGradingResponse({
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

  assert.deepEqual(result.openedUrls, ['https://example.test/fail']);
  assert.deepEqual(result.reportUrls, ['https://example.test/report.xml']);
});
