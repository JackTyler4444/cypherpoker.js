/**
* @class SRACryptoWorker Asynchronous Web Worker implementation of the SRA cryptosystem.
* @name SRACryptoWorker
*/
self.importScripts("BigInteger.min.js"); //very important!
var useCrypto = false; //use browser's crypto interface?
try {
   //sometimes crypto is defined but getRandomValues isn't
   if (typeof(crypto.getRandomValues) == "function") {
      useCrypto = true;
   }
} catch (err) {
}
/**
* @typedef {Object} keypair An encryption/decryption key pair and associated
* prime value. Contains:<br/><br/>
* <code><b>encKey</b></code>: A string representation of the encryption key.<br/>
* <code><b>decKey</b></code>: A String representation of the decryption key.<br/>
* <code><b>prime</b></code>: A string representation of the associated prime number.<br/>
* <br/>
* All values are either in hexadecimal (pre-pended with "0x"), or decimal. Keys
* may be swapped prior to first use if desired.
* @private
*/

/**
* Handles all externally received messages from the host.
*
* External-to-internal function map:<br/>
* <br/>
* "randomPrime" => {@link generateRandomPrime}<br/>
* "checkPrime" => {@link checkPrime}<br/>
* "randomKeypair" => {@link generateRandomKeypair}<br/>
* "randomQuadResidues" => {@link generateRandomQuadResidues}<br/>
* "checkResidues" => {@link checkResidues}<br/>
* "encrypt" => {@link encrypt}<br/>
* "decrypt" => {@link decrypt}
* @private
* @param {Object} event A standard Worker "message" event.
*/
function handleMessage (event) {
   var request = event.data;
   var result = {};
   switch (event.data.method) {
      case "randomPrime":
         var bitLength = event.data.params.bitLength;
         var radix = event.data.params.radix;
         if (isNaN(radix)) {
            radix = 16; //default to hex
         }
         result = generateRandomPrime(bitLength, radix);
         break;
      case "checkPrime":
         var primeVal = event.data.params.prime.trim();
         if (primeVal.startsWith("0x")) {
            primeVal = primeVal.substring(2);
            radix = 16;
         } else {
            radix = 10;
         }
         result = checkPrime(primeVal, radix);
         break;
      case "randomKeypair":
         primeVal = event.data.params.prime.trim();
         if (primeVal.startsWith("0x")) {
            primeVal = primeVal.substring(2);
            radix = 16;
         } else {
            radix = 10;
         }
         result = generateRandomKeypair(primeVal, radix);
         break;
      case "randomQuadResidues":
         primeVal = event.data.params.prime.trim();
         var numValues = event.data.params.numValues;
         if (primeVal.startsWith("0x")) {
            primeVal = primeVal.substring(2);
            radix = 16;
         } else {
            radix = 10;
         }
         result = generateRandomQuadResidues(primeVal, numValues, radix);
         break;
      case "checkResidues":
         var residues = event.data.params.residues;
         primeVal = event.data.params.prime.trim();
         if (primeVal.startsWith("0x")) {
            primeVal = primeVal.substring(2);
            var primeRadix = 16;
         } else {
            primeRadix = 10;
         }
         var residueObjects = new Array();
         for (var count=0; count < residues.length; count++) {
            var currentValue = residues[count].trim();
            if (currentValue.startsWith("0x")) {
               currentValue = currentValue.substring(2);
               radix = 16;
            } else {
               radix = 10;
            }
            residueObjects.push({"value":currentValue, "radix":radix});
         }
         result = checkResidues(residueObjects, primeVal, primeRadix);
         break;
      case "encrypt":
         var keypair = event.data.params.keypair;
         if (keypair.encKey.startsWith("0x")) {
            keypair.encKey = keypair.encKey.substring(2);
            keypair.prime = keypair.prime.substring(2);
            var keyRadix = 16;
         } else {
            keyRadix = 10;
         }
         var value = event.data.params.value;
         if (value.startsWith("0x")) {
            var encValue = value.substring(2);
            var valueRadix = 16;
         } else {
            encValue = value;
            valueRadix = 10;
         }
         result = encrypt (encValue, valueRadix, keypair, keyRadix);
         break;
      case "decrypt":
            keypair = event.data.params.keypair;
            if (keypair.decKey.startsWith("0x")) {
               keypair.decKey = keypair.decKey.substring(2);
               keypair.prime = keypair.prime.substring(2);
               var keyRadix = 16;
            } else {
               keyRadix = 10;
            }
            var value = event.data.params.value;
            if (value.startsWith("0x")) {
               var decValue = value.substring(2);
               var valueRadix = 16;
            } else {
               decValue = value;
               valueRadix = 10;
            }
            result = decrypt (decValue, valueRadix, keypair, keyRadix);
            break;
      default:
         break;
    }
    postMessage({"result": result, "requestID": request.requestID});
}

/**
* Generates a pseudo-random positive integer using the most secure method available
* (the second option can probably be improved).
*
* @param {Number} maxValue The returned random integer will be between 0 and
* this parameter.
* @return {Number|Integer} A pseudo-random positive integer value in the
* range 0 to maxValue.
* @private
*/
function randomInteger(maxValue) {
   if (useCrypto) {
      //use safer crypto interface if available
      var arr = new Uint32Array(2);
      crypto.getRandomValues(arr);
      var multiplier = 0;
      (arr[0] > arr[1]) ? multiplier = arr[1] / arr[0] :  multiplier = arr[0] / arr[1];
      return (Math.round(multiplier * maxValue));
   } else {
      //the second option
      return (Math.round(Math.random() * maxValue));
   }
}

/**
* Generates a pseudo-random bit string of a given length.
*
* @param {Number} bitLength The number of bits / length of the result.
* @return {String} A pseudo-random bit string of length bitLength.
* @private
*/
function randomBitStr(bitLength) {
   return (Array.from({length:bitLength}, (v, i) => {return ((i==0) ? 1 : randomInteger(1))}).join(""));
}

/**
* Generates a random n-bit prime number and returns it in a given radix.
*
* @param {Number} bitLength The number of bits to use for the generated prime
* value.
* @param {Number} radix=16|10 The radix of the returned value string. Must be
* either 16 or 10
* @return {String} A bitLength-length prime number value represented as a string,
* either a hexadecimal value (if radix is 16), or a decimal value (if radix is 10).
* @private
*/
function generateRandomPrime(bitLength, radix) {
   var bitStr = randomBitStr(bitLength);
   var bi_prime = bigInt(bitStr, 2);
   while (bi_prime.isPrime() == false) {
      bi_prime = bi_prime.minus(bigInt.one);
   }
   if (radix == 16) {
      return ("0x" + bi_prime.toString(radix));
   } else {
      return (bi_prime.toString(radix));
   }
}

/**
* Checks whether the input prime value string is actually a prime value.
*
* @param {String} primeVal The string representation of the prime value to check.
* @param {Number} radix The expected radix of primeVal, either 16 (hex) or
* 10 (dec).
* @return {Boolean} True if the primeVal string represents a prime number value.
* @private
*/
function checkPrime(primeVal, radix) {
   var bi_prime = bigInt(primeVal, radix);
   return (bi_prime.isPrime());
}

/**
* Generates a random keypair from a given prime number.
*
* @param {String} primeVal The prime number value representation to use to
* generate the keypair.
* @param {Number} radix The assumed radix of the primeVal value and for the
* generated keypair.
* @return {keypair} The generated keypair+prime value object in the specified
* radix.
* @private
*/
function generateRandomKeypair(primeVal, radix) {
   var bi_prime = bigInt(primeVal, radix);
   var bi_phi_prime = bi_prime.minus(1); //assume this is a prime number
   var encKey = bigInt(randomBitStr(bi_phi_prime.bitLength()), 2);
   var done = false;
   while (!done) {
      try {
         var decKey = encKey.modInv(bi_phi_prime);
         done = true;
      } catch (err) {
         encKey = encKey.minus(1);
         done = false;
      }
   }
   if (radix == 16) {
      return ({"keypair":{"encKey":"0x"+encKey.toString(radix), "decKey":"0x"+decKey.toString(radix), "prime":"0x"+bi_prime.toString(16)}});
   } else {
      return ({"encKey":encKey.toString(radix), "decKey":decKey.toString(radix), "prime":bi_prime.toString(10)});
   }
}

/**
* Generates a fixed series of sequential quadratic residues modulo a given prime
* value. This is done by halving the prime minus 1 and using that as the
* starting value of the lowest possible quadratic residue.
* In other words, the starting point for the quadratic residue series is:
* <code>(primeVal-1)/2</code>
*
* @param {String} primeVal The representation of the prime number to use to
* generate the quadratic residues.
* @param {Number} numValues The number of sequential quadratic residues to
* generate.
* @param {Number} radix The assumed radix of primeVal and of the generated
* quadratic residues.
* @return {Array} The sequentially generated quadratic residues as
* string representations in the given radix.
* @private
*/
function generateRandomQuadResidues(primeVal, numValues, radix) {
   var residues = new Array();
   var bi_prime = bigInt(primeVal, radix);
   var bi_phi_prime = bi_prime.minus(1); //assume this is a prime number
   var bi_exp = bi_phi_prime.divide(2);
   var currentValue = bi_exp.minus(1); //start with one less than half the prime
   while (residues.length < numValues) {
      if (currentValue.modPow(bi_exp, bi_prime).equals(1)) {
         if (radix == 16) {
            residues.push("0x"+currentValue.toString(16));
         } else {
            residues.push(currentValue.toString(10));
         }
      }
      currentValue = currentValue.plus(1);
   }
   return (residues);
}

/**
* Calculates the quadratic residues / non-residues of a series of numbers
* modulo a given prime value.
*
* @param {Array} residueObjects Objects containing:
* @param {String} residueObjects.value The representation of the value to calculate
* quadratic residue / non-residue for.
* @param {Number} residueObjects.radix The assumed radix of the associated value.
* @param {Number} radix The assumed radix of primeVal.
* @return {Array} The calculated quadratic residues (1) or non-residues (primeVal-1)
* of the residueObjects array with the indexes of the input array matching the
* indexes of the results.
* @private
*/
function checkResidues(residueObjects, primeVal, primeRadix) {
   var residues = new Array();
   var bi_prime = bigInt(primeVal, primeRadix);
   var bi_phi_prime = bi_prime.minus(1); //assume this is a prime number
   var bi_exp = bi_phi_prime.divide(2);
   var currentValue = bi_exp.minus(1); //start with one less than half the prime
   var returnValues = new Array();
   for (var count=0; count < residueObjects.length; count++) {
      var currentResObject = residueObjects[count];
      var currentValue = bigInt(currentResObject.value, currentResObject.radix);
      returnValues.push(currentValue.modPow(bi_exp, bi_prime).toString(currentResObject.radix));
   }
   return (returnValues);
}

/**
* Encrypts a value with a keypair object.
*
* @param {String} encValue The representation of the value to encrypt.
* @param {Number} valueRadix The assumed radix of encValue.
* @param {keypair} keypair A keypair to use for the operation.
* @param {Number} keyRadix The assumed radix of all of the values in the keypair.
* @return {String} The encrypted value as a string representation in the valueRadix.
* @private
*/
function encrypt (encValue, valueRadix, keypair, keyRadix) {
   var value = bigInt(encValue, valueRadix);
   var key = bigInt(keypair.encKey, keyRadix);
   var prime = bigInt(keypair.prime, keyRadix);
   var result = value.modPow(key, prime);
   if (valueRadix == 16) {
      return ("0x"+result.toString(valueRadix));
   } else {
      return (result.toString(valueRadix));
   }
}


/**
* Decrypts a value with a keypair object.
*
* @param {String} decValue The representation of the value to decrypt.
* @param {Number} valueRadix The assumed radix of decValue.
* @param {keypair} keypair A keypair to use for the operation.
* @param {Number} keyRadix The assumed radix of all of the values in the keypair.
* @return {String} The decrypted value as a string representation in the valueRadix.
* @private
*/
function decrypt (decValue, valueRadix, keypair, keyRadix) {
   var value = bigInt(decValue, valueRadix);
   var key = bigInt(keypair.decKey, keyRadix);
   var prime = bigInt(keypair.prime, keyRadix);
   var result = value.modPow(key, prime);
   if (valueRadix == 16) {
      return ("0x"+result.toString(valueRadix));
   } else {
      return (result.toString(valueRadix));
   }
}

//setup message handler
onmessage = handleMessage;

//signal host that worker is ready to accept requests
postMessage({"ready":true});
