window.input = {
  columns:
  [
    [{id: 'a1', caption: "A1"}, {id: 'a2', caption: "A2"}, {id: 'a3', caption: "A3"}],
    [{id: 'b1', caption: "B1"}, {id: 'b2', caption: "B2"}, {id: 'b3', caption: "B3"}],
    [{id: 'c1', caption: "C1"}, {id: 'c2', caption: "C2"}, {id: 'c3', caption: "C3"}]
  ],
  connections: [
    {from: "a2", to: "b2", trigger: "a2-b2", id: "a2-b2", reverse: false},
    {from: "b2", to: "c2", trigger: "b2-c2", id: "b2-c2", reverse: false},
    {from: "a1", to: "b2", trigger: "a1-b2", id: "a1-b2", reverse: false},
    {from: "a3", to: "b2", trigger: "a3-b2", id: "a3-b2", reverse: false}
  ]
  
}

window.input = {
  columns:
  [
    // External stuff
    [
     {
        id: "gnip",
        caption: "Gnip"
      },
      {
        id: "wikipedia",
        caption: "Wikipedia"
      }
    ],
    // Agents
    [
      {
        id: "twitter-agent",
        caption: "Twitter Agent"
      },
      {
        id: "newsfeed-agent",
        caption: "Newsfeed Agent",
        functions: [{trigger: "newsfeed-agent/feed/analyze-item",
                     caption: "analyze-item"},
                    {trigger: "newsfeed-agent/feed/found-item",
                     caption: "found-item"},
                    {trigger: "newsfeed-agent/feed/heartbeat",
                     caption: "heartbeat"},
                    {trigger: "newsfeed-agent/feed/check-all-newsfeeds",
                     caption: "check-all-newsfeeds"},
                    ]
      },
      {
        id: "wikipedia-agent",
        caption: "Wikipedia Agent"
      }
    ],
    // Internal processing
    [
      {
        id: "evidence-service",
        caption: "Evidence Service",
        functions: [{trigger: "evidence-service/api/get-artifact-current",
                     caption: "get-artifact-current"},
                    {trigger: "evidence-service/api/get-artifact-version",
                     caption: "get-artifact-version"},
                    {trigger: "evidence-service/api/get-artifact-versions",
                     caption: "get-artifact-versions"},
                    {trigger: "evidence-service/api/get-event-evidence",
                     caption: "get-artifact-version"},
                    {trigger: "get-event-evidence/api/get-list-all",
                     caption: "get-list-all"},
                    {trigger: "evidence-service/api/receive-evidence",
                     caption: "receive-evidence"},
                    {trigger: "evidence-service/server/heartbeat",
                     caption: "heartbeat"}]
      }

    ],
    // More internal processing
    [
      {
        id: "lagotto",
        caption: "Lagotto"
      },
      {
        id: "status-service",
        caption: "Status Service"
      }
    ]
  ],
  connections : [
    {from: "evidence-service", to: "lagotto", trigger: "evidence-service/deposits/send-deposit", id: "evidence-service/deposits/send-deposit", reverse: false},
    {from: "evidence-service", to: "lagotto", trigger: "evidence-service/deposits/send-deposit-ok", id: "evidence-service/deposits/send-deposit-ok", reverse: true},
    {from: "wikipedia", to: "wikipedia-agent", trigger: "wikipedia-agent/restbase-input/query", id: "wikipedia-agent/restbase-input/query", reverse: true},
    {from: "wikipedia", to: "wikipedia-agent", trigger: "wikipedia-agent/restbase-input/error", id: "wikipedia-agent/restbase-input/error", reverse: false},
    {from: "wikipedia", to: "wikipedia-agent", trigger: "wikipedia-agent/restbase-input/ok", id: "wikipedia-agent/restbase-input/ok", reverse: false},
    {from: "wikipedia", to: "wikipedia-agent", trigger: "wikipedia-agent/input/recent-changes-input", id: "wikipedia-agent/input/recent-changes-input", reverse: false},
    {from: "wikipedia-agent", to: "evidence-service", trigger: "wikipedia-agent/evidence/sent", id: "wikipedia-agent/evidence/sent", reverse: false},
    {from: "wikipedia-agent", to: "evidence-service", trigger: "wikipedia-agent/evidence/sent-ok", id: "wikipedia-agent/evidence/sent-ok", reverse: false},
    {from: "twitter-agent", to: "evidence-service", trigger: "twitter-agent/artifact/fetch", id: "twitter-agent/artifact/fetch", reverse: true},
    {from: "twitter-agent", to: "evidence-service", trigger: "twitter-agent/evidence/sent", id: "twitter-agent/evidence/sent", reverse: false},
    {from: "twitter-agent", to: "evidence-service", trigger: "twitter-agent/evidence/sent-ok", id: "twitter-agent/evidence/sent-ok", reverse: false},
    {from: "newsfeed-agent", to: "evidence-service", trigger: "newsfeed-agent/artifact/fetch", id: "newsfeed-agent/artifact/fetch", reverse: true},
    {from: "newsfeed-agent", to: "evidence-service", trigger: "newsfeed-agent/evidence-sent", id: "newsfeed-agent/evidence-sent", reverse: false},
    {from: "newsfeed-agent", to: "evidence-service", trigger: "newsfeed-agent/evidence-sent-ok", id: "newsfeed-agent/evidence-sent-ok", reverse: false},
    
    // {from: "", to: "", trigger: "", reverse: false},
    // {from: "", to: "", trigger: "", reverse: false},
    // {from: "", to: "", trigger: "", reverse: false},
    // {from: "", to: "", trigger: "", reverse: false},


  ]
};

window.config = {
  columnWidth: 120,
  columnPadding: 100,

  boxHeight: 80,
  boxPaddingTop: 20,
  boxPaddingBottom: 20,
  boxPaddingLeft: 20,
  boxPaddingRight: 20,
  boxMarginBottom: 20,


  paddingLeft: 50,
  paddingTop: 50,

  boxCaptionTextHeight: 10,
  boxCaptionTextPaddingTop: 8,
  boxCaptionTextPaddingLeft: 8,
  boxCaptionTextPaddingBottom: 10,

  functionCaptionTextHeight: 10,
  functionCaptionTextPaddingTop: 8,
  functionCaptionTextPaddingLeft: 8,

  connectionSpacing: 10

};

var canvas = document.getElementById("canvas");
var header = document.getElementById("header");
var context = canvas.getContext("2d");
canvas.width = document.body.clientWidth;
canvas.height = document.body.clientHeight - header.clientHeight;

// Transitions.

// connection id => transition progress as float.
var transitions = {};

// connection id => integer number of queued transitions.
var transitionQueue = {};

function tickTransitions() {
  for (let connection of input.connections) {
    // Tick all transitions.
    if (transitions[connection.id] != undefined) {
      transitions[connection.id] += 0.02;
    }

    // Finish those that are over.
    if (transitions[connection.id] > 1) {
      transitions[connection.id] = undefined;
    }

    // Cue transitions from the queue if the transition has finished.
    // Undefined not > 0.
    if (transitions[connection.id] == undefined && transitionQueue[connection.id] > 0) {
      transitions[connection.id] = 0;
      transitionQueue[connection.id] --;
    }
  }
}

function findBox(id) {
  for (let stage of window.input.columns) {
    for (let column of stage) {
      for (let box of stage) {
        if (box.id == id) {
          return box;
        }
      }
    }
  }
}

// Assign connections to boxes.
function connectAll() {
  console.log("Layout");
  for (let connection of window.input.connections) {
    
    var from = findBox(connection.from);
    var to = findBox(connection.to);
    console.log("Layout connection", connection, "from", from, "to", to);
    from.outboundConnections = (from.outboundConnections || 0) + 1;
    to.inboundConnections = (to.inboundConnections || 0) + 1;

    connection.fromConnectionI = from.outboundConnections;
    connection.toConnectionI = to.inboundConnections;
  }
}

// Give co-ordinates to everything.
function layoutAll() {
  // Boxes.
  var columnX = config.paddingLeft;
  for (let column of input.columns) {
    var boxY = config.paddingTop;
    for (let box of column) {
      box.x = columnX;
      box.y = boxY;
      box.width = config.columnWidth;
      box.height = config.boxPaddingTop + config.boxPaddingBottom +
                   config.boxCaptionTextHeight + config.boxCaptionTextPaddingTop +
                   (box.functions || []).length * (config.functionCaptionTextHeight + config.functionCaptionTextPaddingTop);

      var functionY = box.y + config.boxCaptionTextHeight + config.boxCaptionTextPaddingTop + config.boxCaptionTextPaddingBottom;
      for (let fun of box.functions || []) {
        fun.x = box.x + config.boxCaptionTextPaddingLeft;
        fun.y = functionY;

        functionY += config.functionCaptionTextHeight + config.functionCaptionTextPaddingTop;
      }

      boxY += box.height + config.boxMarginBottom;
    }

    columnX += config.columnWidth + config.columnPadding;
  }

  // Lines.
  for (let connection of input.connections) {
    let from = findBox(connection.from);
    let to = findBox(connection.to);

    connection.x = from.x + config.columnWidth;
    connection.y = from.y + config.connectionSpacing * connection.fromConnectionI;

    connection.xx = to.x;
    connection.yy = to.y + config.connectionSpacing * connection.toConnectionI;
  }
}

// https://gist.github.com/gre/1650294
function easeInOutQuart(t) { return t<.5 ? 8*t*t*t*t : 1-8*(--t)*t*t*t };


function drawAll() {
  canvas.width = canvas.width;
  for (let column of window.input.columns) {
    for (let box of column) {
      // Draw box.
      context.strokeRect(box.x, box.y, box.width, box.height);

      context.fillText(box.caption,
                       box.x + config.boxCaptionTextPaddingLeft,
                       box.y + config.boxCaptionTextHeight + config.boxCaptionTextPaddingTop);

      // Draw functions in box.
      for (let fun of box.functions || []) {
        context.fillText(fun.caption,
                         fun.x + config.functionCaptionTextPaddingLeft,
                         fun.y + config.functionCaptionTextPaddingTop + config.functionCaptionTextHeight);
      }
    }
  }

  // Draw connections
  for (let connection of input.connections) {
    // context.beginPath();
    // context.moveTo(connection.x, connection.y);
    // context.lineTo(connection.xx, connection.yy);
    // context.stroke();

    if (transitions[connection.id] != undefined) {
      // var progress = easeInOutQuart(transitions[connection.id]);
      var progress = Math.sin(Math.PI / 2 * transitions[connection.id]);
      var scale = Math.sin(Math.PI * transitions[connection.id]);

      var x = (connection.xx - connection.x) * progress + connection.x;
      var y = (connection.yy - connection.y) * progress + connection.y;
      context.beginPath();
      context.arc(x, y, scale * 10, 0, 2 * Math.PI, false);
      // context.fillStyle = 'green';
      context.fill();
      // context.lineWidth = 5;
      // context.strokeStyle = '#003300';
      context.stroke();
    }
  }
}

function tick() {
  tickTransitions();
  drawAll();
}

  
window.setInterval(tick, 10);


connectAll();
layoutAll();
drawAll();
