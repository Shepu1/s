function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('hidden');
      setTimeout(() => { editor.refresh(); }, 300);
    }

    const pythonKeywords = [
      "print", "def", "return", "import", "from", "if", "else", "elif",
      "while", "for", "in", "class", "try", "except", "finally",
      "True", "False", "None", "and", "or", "not", "break", "continue",
      "async", "await", "lambda", "global", "with", "as", "pass",
      "input", "len", "range", "str", "int", "float", "list", "dict"
    ];

    CodeMirror.registerHelper("hint", "python", function(editor) {
      const cur = editor.getCursor();
      const token = editor.getTokenAt(cur);
      const start = token.start;
      const end = cur.ch;
      const word = token.string.slice(0, end - start);
      if (!word.trim()) return;
      const list = pythonKeywords.filter(item => item.startsWith(word));
      return {
        list: list,
        from: CodeMirror.Pos(cur.line, start),
        to: CodeMirror.Pos(cur.line, end)
      };
    });

    let editor = CodeMirror.fromTextArea(document.getElementById("code"), {
      mode: "python",
      theme: "darcula",
      lineNumbers: true,
      indentUnit: 4,
      smartIndent: true,
      indentWithTabs: false,
      fontFamily: "'JetBrains Mono', monospace",
      autoCloseBrackets: true,
      extraKeys: {
        "Ctrl-Space": "autocomplete",
        "Enter": "newlineAndIndent"
      },
      hintOptions: { completeSingle: false }
    });

    editor.on("inputRead", function(cm, change) {
        if (change.origin !== "+input") return;
        if (/^[a-zA-Z]*$/.test(change.text[0])) {
             cm.showHint({hint: CodeMirror.hint.python, completeSingle: false});
        }
    });

    let pyodide;
    const outputDiv = document.getElementById("output");

    async function init() {
      try {
        pyodide = await loadPyodide();
        pyodide.setStdin({
          stdin: () => {
            const result = prompt("Input required:");
            if (result === null) return "";
            return result + "\n";
          }
        });
        document.getElementById("loader").style.opacity = "0";
        setTimeout(() => document.getElementById("loader").style.display = "none", 500);
      } catch (err) {
        console.error("Pyodide failed to load", err);
      }
    }
    init();

    async function runPython() {
      if (!pyodide) return;
      outputDiv.innerHTML = '<span style="color: #57965c;">shipu@pc</span>:<span style="color: #3574f0;">~/project</span>$ python shipu.py<br>';
      try {
        pyodide.setStdout({ batched: (str) => {
          outputDiv.innerHTML += str + "<br>";
          outputDiv.scrollTop = outputDiv.scrollHeight;
        }});
        await pyodide.runPythonAsync(editor.getValue());
        outputDiv.innerHTML += '<br><span style="color: #57965c;">shipu@pc</span>:<span style="color: #3574f0;">~/project</span>$ ';
        outputDiv.scrollTop = outputDiv.scrollHeight;
      } catch (e) {
        outputDiv.innerHTML += `<span style="color: #ff6b6b;">Error: ${e}</span><br>`;
      }
    }
