$(document).ready(function() {
  var KB      = 1024;
  var MS_IN_S = 1000;

  var parser;

  var buildAndParseTimer = null;
  var parseTimer         = null;

  var oldGrammar   = null;
  var oldParserVar = null;
  var oldInput     = null;

  function buildSizeAndTimeInfoHtml(title, size, time) {
    return $("<span/>", {
      "class": "size-and-time",
      title:   title,
      html:    (size / KB).toPrecision(2) + "&nbsp;kB, "
                 + time + "&nbsp;ms, "
                 + ((size / KB) / (time / MS_IN_S)).toPrecision(2) + "&nbsp;kB/s"
    });
  }

  function buildErrorMessage(e) {
    return e.line !== undefined && e.column !== undefined
      ? "Line " + e.line + ", column " + e.column + ": " + e.message
      : e.message;
  }

  function build() {
    oldGrammar   = $("#grammar").val();
    oldParserVar = $("#parser-var").val();
    
    $('#build-message').attr("class", "message progress").text("Building the parser...");
    $("#input").attr("disabled", "disabled");
    $("#parse-message").attr("class", "message disabled").text("Parser not available.");
    $("#output").addClass("disabled").text("Output not available.");
    $("#parser-var").attr("disabled", "disabled");
    $("#parser-download").addClass("disabled");

    try {
      var timeBefore = (new Date).getTime();
      parser = PEG.buildParser($("#grammar").val());
      var timeAfter = (new Date).getTime();

      $("#build-message")
        .attr("class", "message info")
        .html("Parser stored and built successfully.")
        .append(buildSizeAndTimeInfoHtml(
          "Parser build time and speed",
          $("#grammar").val().length,
          timeAfter - timeBefore
        ));
      var parserUrl = "data:text/plain;charset=utf-8;base64,"
        + Base64.encode($("#parser-var").val() + " = " + parser.toSource() + ";\n");
      $("#input").removeAttr("disabled");
      $("#parser-var").removeAttr("disabled");
      $("#parser-download").removeClass("disabled").attr("href", parserUrl);

      var result = true;
    } catch (e) {
      $("#build-message").attr("class", "message error").text(buildErrorMessage(e));
      var parserUrl = "data:text/plain;charset=utf-8;base64,"
        + Base64.encode("Parser not available.");
      $("#parser-download").attr("href", parserUrl);

      var result = false;
    }

    doLayout();
    return result;
  }

  function parse() {
    oldInput = $("#input").val();
    
    $("#input").removeAttr("disabled");
    $("#parse-message").attr("class", "message progress").text("Parsing the input...");
    $("#output").addClass("disabled").text("Output not available.");

    try {
      var timeBefore = (new Date).getTime();
      var output = parser.parse($("#input").val());
      var timeAfter = (new Date).getTime();

      $("#parse-message")
        .attr("class", "message info")
        .text("Input stored and parsed successfully.")
        .append(buildSizeAndTimeInfoHtml(
          "Parsing time and speed",
          $("#input").val().length,
          timeAfter - timeBefore
        ));
      $("#output").removeClass("disabled").html(jsDump.parse(output));

      var result = true;
    } catch (e) {
      $("#parse-message").attr("class", "message error").text(buildErrorMessage(e));

      var result = false;
    }

    doLayout();
    return result;
  }

  function buildAndParse() {
    build() && parse();
  }

  function scheduleBuildAndParse() {
    var nothingChanged = $("#grammar").val() === oldGrammar
      && $("#parser-var").val() === oldParserVar;
    if (nothingChanged) { return; }
    
    transaction(function(data) {
      data.grammars[data.current].grammar = $("#grammar").val();
    })
    
    if (buildAndParseTimer !== null) {
      clearTimeout(buildAndParseTimer);
      buildAndParseTimer = null;
    }
    if (parseTimer !== null) {
      clearTimeout(parseTimer);
      parseTimer = null;
    }

    buildAndParseTimer = setTimeout(function() {
      buildAndParse();
      buildAndParseTimer = null;
    }, 500);
  }

  function scheduleParse() {
    if ($("#input").val() === oldInput) { return; }
    if (buildAndParseTimer !== null) { return; }
    
    transaction(function(data) {
      data.grammars[data.current].input = $("#input").val();
    })
    
    if (parseTimer !== null) {
      clearTimeout(parseTimer);
      parseTimer = null;
    }

    parseTimer = setTimeout(function() {
      parse();
      parseTimer = null;
    }, 500);
  }

  function doLayout() {
    /*
     * This forces layout of the page so that the |#columns| table gets a chance
     * make itself smaller when the browser window shrinks.
     */
    if ($.browser.msie || $.browser.opera) {
      $("#left-column").height("0px");
      $("#right-column").height("0px");
    }
    $("#grammar").height("0px");
    $("#input").height("0px");

    if ($.browser.msie || $.browser.opera) {
      $("#left-column").height(($("#left-column").parent().innerHeight() - 2) + "px");
      $("#right-column").height(($("#right-column").parent().innerHeight() - 2) + "px");
    }

    $("#grammar").height(($("#grammar").parent().parent().innerHeight() - 14) + "px");
    $("#input").height(($("#input").parent().parent().innerHeight() - 14) + "px");
  }
  
  function transaction(transactionFn) {
    var key = 'pegjs-online';
    var data = store.get(key);
    if (!data) {
      data = {};
      data.current = 'calculator';
      data.grammars = {};
      data.grammars[data.current] = {
        grammar: $("#grammar").val(),
        input: $("#input").val()
      }
    }
    transactionFn(data);
    store.set(key, data);
  }
  
  function rebuildGrammarSelect() {
    var html = '';
    transaction(function(data) {
      for (var name in data.grammars) {
        var selected = (name == data.current) ? ' selected' : '';
        html += '<option'+selected+'>' + name + '</option>';
      }
    })
    if (html) { $('#grammar-select').html(html) }
  }
  
  function selectCurrentGrammar() {
    var name = $('#grammar-select').val();
    if (!name) { return; }
    transaction(function(data) {
      data.current = name;
      $("#grammar").val(data.grammars[name].grammar);
      $("#input").val(data.grammars[name].input);
    })
    scheduleBuildAndParse();
  }
  
  $("#grammar-select").change(selectCurrentGrammar);
  $("#grammar-add-button").click(function() {
    var name = prompt("What do you want to call it?");
    if (!name) { return; }
    transaction(function(data) {
      data.grammars[name] = { grammar: name + ' = ""', input: '' };
      data.current = name;
    })
    rebuildGrammarSelect();
    selectCurrentGrammar();
  })
  $("#grammar-del-button").click(function() {
    var name = $("#grammar-select")[0].value;
    var goAhead = confirm("Are you sure you want to remove \"" + name + "\"?");
    if (!goAhead) { return; }
    transaction(function(data) {
      delete data.grammars[name];
    })
    rebuildGrammarSelect();
    selectCurrentGrammar();
  })
  
  jsDump.HTML = true;

  $("#grammar, #parser-var")
    .change(scheduleBuildAndParse)
    .mousedown(scheduleBuildAndParse)
    .mouseup(scheduleBuildAndParse)
    .click(scheduleBuildAndParse)
    .keydown(scheduleBuildAndParse)
    .keyup(scheduleBuildAndParse)
    .keypress(scheduleBuildAndParse);

  $("#input")
    .change(scheduleParse)
    .mousedown(scheduleParse)
    .mouseup(scheduleParse)
    .click(scheduleParse)
    .keydown(scheduleParse)
    .keyup(scheduleParse)
    .keypress(scheduleParse);

  doLayout();
  $(window).resize(doLayout);

  $("#content").show();

  $("#grammar, #parser-var").removeAttr("disabled");
  // var storedGrammar = store.get('pegjs-live-grammar');
  // var storedInput = store.get('pegjs-live-input');
  // if (storedGrammar) { $("#grammar").val(storedGrammar); }
  // if (storedInput) { $("#input").val(storedInput); }
  
  $("#grammar").focus();
  
  rebuildGrammarSelect();
  selectCurrentGrammar();
  buildAndParse();
});
