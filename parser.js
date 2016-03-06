// skipSpace
function skipSpace(string) {
  // Allow comments
  string = string.replace( /\/\/.*|\/\*[^]*?\*\//g,"");
  var first = string.search(/\S/);
  if (first == -1) return "";
  return string.slice(first);
}

// parseApply
function parseApply(expr, program) {
  program = skipSpace(program);
  if (program[0] != "(")
    return {expr: expr, rest: program};

  program = skipSpace(program.slice(1));
  expr = {type: "apply", operator: expr, args: []};
  while (program[0] != ")") {
    var arg = parseExpression(program);
    expr.args.push(arg.expr);
    program = skipSpace(arg.rest);
    if (program[0] == ",")
      program = skipSpace(program.slice(1));
    else if (program[0] != ")")
      throw new SyntaxError("Expected ',' or ')'");
  }
  return parseApply(expr, program.slice(1));
}

// parseExpression
function parseExpression(program) {
  // Elimina espacios en blanco.
  program = skipSpace(program);
  var match, expr;
  /*
   Si detecta algo que empieza en comillas
   y está encerrado en otra comilla, lo define
   cómo un string. El valor es lo que está dentro
   de ().
   */
  if (match = /^"([^"]*)"/.exec(program))
    expr = {type: "value", value: match[1]};

  /*
   Si detecta números y un caracter de separación
   lo llama un  valor.
   */
  else if (match = /^(-\d+|\d+)\b/.exec(program))
    expr = {type: "value", value: Number(match[0])};
  /*
   Soporte para punto flotante.
   */
  else if (match = /(\+|-)?\d+\.\d*\b/.exec(program))
    expr = {type: "value", value: Number(match[0])};
  /*
   Palabras
   */
  else if (match = /^[^\s(),"]+/.exec(program))
    expr = {type: "word", name: match[0]};
  else
    throw new SyntaxError("Unexpected syntax: " + program);

  return parseApply(expr, program.slice(match[0].length));
}

// parse
function parse(program) {
  var result = parseExpression(program);
  if (skipSpace(result.rest).length > 0)
    throw new SyntaxError("Unexpected text after program");
  return result.expr;
}

// evaluate
function evaluate(expr, env) {
  switch(expr.type) {
    case "value":
      return expr.value;

  case "int":
    return expr.value;

  case "float":
      return expr.value;

  case "word":
      if (expr.name in env)
        return env[expr.name];
      else
        throw new ReferenceError("Undefined variable: " +
                                 expr.name);
  case "apply":
      if (expr.operator.type == "word" &&
          expr.operator.name in specialForms)
        return specialForms[expr.operator.name](expr.args,
                                                env);
      var op = evaluate(expr.operator, env);
      if (typeof op != "function")
        throw new TypeError("Applying a non-function.");
      return op.apply(null, expr.args.map(function(arg) {
        return evaluate(arg, env);
      }));
  }
}


/*------------------------------------------------*/
/*----------------specialForms--------------------*/
/*------------------------------------------------*/

// if
var specialForms = Object.create(null);
specialForms["if"] = function(args, env) {
  if (args.length != 3)
    throw new SyntaxError("Bad number of args to if");

  if (evaluate(args[0], env) !== false)
    return evaluate(args[1], env);
  else
    return evaluate(args[2], env);
};

// while
specialForms["while"] = function(args, env) {
  if (args.length != 2)
    throw new SyntaxError("Bad number of args to while");

  while (evaluate(args[0], env) !== false)
    evaluate(args[1], env);

  return false;
};

// for
specialForms["for"] = function(args, env) {
  if (args.length != 4)
    throw new SyntaxError("Bad number of args to for");

  for (evaluate(args[0], env); evaluate(args[1], env); evaluate(args[2], env))
    evaluate(args[3], env);

  return false;
};

// fun
specialForms["fun"] = function(args, env) {
  if (!args.length)
    throw new SyntaxError("Functions need a body");
  function name(expr) {
    if (expr.type != "word")
      throw new SyntaxError("Arg names must be words");
    return expr.name;
  }
  var argNames = args.slice(0, args.length - 1).map(name);
  var body = args[args.length - 1];

  return function() {
    if (arguments.length != argNames.length)
      throw new TypeError("Wrong number of arguments");
    var localEnv = Object.create(env);
    for (var i = 0; i < arguments.length; i++)
      localEnv[argNames[i]] = arguments[i];
    return evaluate(body, localEnv);
  };
};

// do
specialForms["do"] = function(args, env) {
  var value = false;
  args.forEach(function(arg) {
    value = evaluate(arg, env);
  });
  return value;
};

// define
specialForms["define"] = function(args, env) {
  if (args.length != 2 || args[0].type != "word")
    throw new SyntaxError("Bad use of define");
  var value = evaluate(args[1], env);
  env[args[0].name] = value;
  return value;
};

// set
specialForms["set"] = function(args, env) {
  if (args.length != 2 || args[0].type != "word")
    throw new SyntaxError("Bad use of set");
  if(Object.prototype.hasOwnProperty.call(env, args[0])){
    var value = evaluate(args[1], env);
    env[args[0].name] = value;
    return value;
  } else {
    nextEnv = Object.getPrototypeOf(env);
    while(nextEnv != null & !Object.prototype.hasOwnProperty.call(env, args[0])){
      nextEnv = Object.getPrototypeOf(nextEnv);
    }
    if(nextEnv != null){
      var value = evaluate(args[1], env);
      env[args[0].name] = value;
      return value;
    }
  }
  throw new ReferenceError("No se ha declarado la variable");
};


/*------------------------------------------------*/
/*--------------------topEnv----------------------*/
/*------------------------------------------------*/

// defines env
var topEnv = Object.create(null);

// boolean vals
topEnv["true"]  = true;
topEnv["false"] = false;

// other operands
// <= and >= added
["+", "-", "*", "/", "==", "<", ">", "<=", ">="].forEach(function(op) {
  topEnv[op] = new Function("a, b", "return a " + op + " b;");
});

// print func
topEnv["print"] = function(value) {
  console.log(value);
  return value;
};

// array
topEnv["array"] = function() {
  return Array.prototype.slice.call(arguments, 0);
};

// length
topEnv["length"] = function(array) {
  return array.length;
};

// element
topEnv["element"] = function(array, n) {
  return array[n];
};

/*
 Sort
 Numeric arrays (or arrays of primitive type) are sorted using the C++
 standard library function std::qsort which implements some variation
 of quicksort (usually introsort).
 */
topEnv["sort"] = function(array) {
  return array.sort();
};

//sum
topEnv["sum"] = function(array){
  add = function(a,b){
    return a+b;
  };
  return array.reduce(add, 0);
};

//sumarray
topEnv["sumarray"] = function(a1, a2){
  var a3 = [];
  if(a1.length != a2.length){
    throw new ReferenceError("Arreglos de tamaño diferent");
  }
  for(var i = 0; i < a1.length; i++){
    a3[i] = a1[i] +  a2[i];
  }
  return a3;
};

// run program
function run() {
  var env = Object.create(topEnv);
  var program = Array.prototype.slice
    .call(arguments, 0).join("\n");
  return evaluate(parse(program), env);
}

/*------------------------------------------------*/
/*--------------------Pruebas---------------------*/
/*------------------------------------------------*/

//-------------
// While
//-------------
run("do(define(total, 0),",
    "   define(count, 1),",
    "   while(<=(count, 11),",
    "         do(define(total, +(total, count)),",
    "            define(count, +(count, 1)))),",
    "   print(total))");

//-------------
// For
//-------------
run("do(define(total, 0),",
    "   define(n, 11),",
    "   for(define(count, 0), <=(count, n), define(count, +(count, 1)),",
    "         do(define(total, +(total, count)))),",
    "   print(total))");

//-------------
// Arrays
//-------------
// array
run("do(define(x, array(1,2,3,4)), print(x))");
// lenght
run("do(define(x, array(1,2,3,4)), print(length(x)))");
// element
run("do(define(x, array(1,2,3,4)), print(element(x, 2)))");
// sort
run("do(define(x, array(1,5,2,6)), print(sort(x)))");
// sum
run("do(define(x, array(1,5,2,6)), print(sum(x)))");
// summ array
run("do(define(x, array(1,5,2,6)),define(y, array(2,5,1,4)), print(sumarray(x,y)))");

//-------------
// Comments
//-------------
run("do(/*esto es un comentario de varias líneas \n sigue siendo un comentario*/ define(x, +(3,2)),print(x))");

//-------------
// Scope
//-------------
run("do(define(x, +(3, set(x, +(5, 4)))), print(x))");
