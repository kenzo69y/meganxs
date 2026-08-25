(function(){
  if(typeof window.parseInput !== "function") return;

  const originalParseInput = window.parseInput;
  const openingBalancePattern = /\bopening\s+balance\b/i;

  window.parseInput = function(text){
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    if(!lines.length) return originalParseInput(text);

    const header = lines[0];
    const cleaned = [header, ...lines.slice(1).filter(line => !openingBalancePattern.test(line))].join("\n");
    return originalParseInput(cleaned);
  };

  const input = document.querySelector("#rawInput");
  if(input && input.value.trim() && typeof window.processData === "function"){
    window.processData("Opening Balance diabaikan");
  }
})();
