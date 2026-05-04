/**
 * Ejemplos de Uso - SMB File Detector
 * 
 * Demostraciones de cómo usar el módulo SMBFileDetector
 */

// ============================================
// EJEMPLO 1: Uso Básico
// ============================================

async function example1_basicUsage() {
  console.log('=== EJEMPLO 1: Uso Básico ===\n');

  const detector = new SMBFileDetector();

  const credentials = {
    path: '\\\\servidor\\compartida\\datos',
    username: 'usuario',
    password: 'contraseña',
    pattern: 'datos_*.csv'
  };

  const result = await detector.detect(credentials);

  console.log('Resultado:', result);
  console.log('\nLogs exportados:');
  console.log(detector.exportLogs());
}

// ============================================
// EJEMPLO 2: Con Dominio
// ============================================

async function example2_withDomain() {
  console.log('=== EJEMPLO 2: Con Dominio ===\n');

  const detector = new SMBFileDetector();

  const credentials = {
    path: '\\\\servidor.empresa.com\\compartida\\reportes',
    username: 'juan.perez',
    password: 'MiContraseña123',
    domain: 'EMPRESA',
    pattern: 'reporte_*.csv'
  };

  const result = await detector.detect(credentials);

  console.log('Estado:', result.status);
  console.log('Archivo seleccionado:', result.selectedFile);
  console.log('Número de logs:', result.logs.length);
}

// ============================================
// EJEMPLO 3: Patrón Exacto
// ============================================

async function example3_exactPattern() {
  console.log('=== EJEMPLO 3: Patrón Exacto ===\n');

  const detector = new SMBFileDetector();

  const credentials = {
    path: '\\\\192.168.1.100\\archivos',
    username: 'admin',
    password: 'admin123',
    pattern: 'datos.csv'  // Patrón exacto, sin wildcards
  };

  const result = await detector.detect(credentials);

  console.log('Resultado:', result);
}

// ============================================
// EJEMPLO 4: Manejo de Errores
// ============================================

async function example4_errorHandling() {
  console.log('=== EJEMPLO 4: Manejo de Errores ===\n');

  const detector = new SMBFileDetector();

  // Credenciales incompletas
  const invalidCredentials = {
    path: '\\\\servidor\\compartida',
    username: 'usuario'
    // Falta password y pattern
  };

  const result = await detector.detect(invalidCredentials);

  console.log('Estado:', result.status);
  console.log('Error:', result.error);
  console.log('\nLogs de error:');
  result.logs.forEach(log => {
    if (log.type === 'error') {
      console.log(`  ${log.prefix}`);
    }
  });
}

// ============================================
// EJEMPLO 5: Validación de Patrón
// ============================================

function example5_patternValidation() {
  console.log('=== EJEMPLO 5: Validación de Patrón ===\n');

  const detector = new SMBFileDetector();

  // Patrones de prueba
  const testPatterns = [
    { pattern: 'datos_*.csv', files: ['datos_2024.csv', 'datos_2025.csv', 'otros.csv'] },
    { pattern: 'reporte.csv', files: ['reporte.csv', 'reporte_2024.csv'] },
    { pattern: '*_final.csv', files: ['datos_final.csv', 'reportes_final.csv', 'final.csv'] },
    { pattern: 'archivo_[0-9]*.csv', files: ['archivo_1.csv', 'archivo_123.csv', 'archivo.csv'] }
  ];

  testPatterns.forEach(test => {
    console.log(`\nPatrón: ${test.pattern}`);
    const regex = detector.patternToRegex(test.pattern);
    const matches = test.files.filter(file => regex.test(file));
    console.log(`  Archivos: ${test.files.join(', ')}`);
    console.log(`  Coincidencias: ${matches.join(', ') || 'ninguna'}`);
  });
}

// ============================================
// EJEMPLO 6: Flujo Completo con Interfaz
// ============================================

async function example6_fullFlow() {
  console.log('=== EJEMPLO 6: Flujo Completo ===\n');

  // Simular datos del formulario
  const formData = {
    networkPath: '\\\\servidor\\compartida\\datos',
    username: 'usuario',
    password: 'contraseña',
    domain: 'DOMINIO',
    filePattern: 'datos_*.csv'
  };

  console.log('Datos del formulario:');
  console.log(JSON.stringify(formData, null, 2));

  const detector = new SMBFileDetector();

  const credentials = {
    path: formData.networkPath,
    username: formData.username,
    password: formData.password,
    domain: formData.domain,
    pattern: formData.filePattern
  };

  console.log('\nIniciando detección...\n');

  const result = await detector.detect(credentials);

  // Mostrar resultado
  console.log('\n=== RESULTADO FINAL ===');
  console.log(`Estado: ${result.status}`);

  if (result.status === 'READY') {
    console.log(`✔ Archivo seleccionado: ${result.selectedFile}`);
  } else {
    console.log(`❌ Error: ${result.message}`);
    if (result.files && result.files.length > 0) {
      console.log(`   Archivos encontrados: ${result.files.join(', ')}`);
    }
  }

  console.log(`\nTotal de logs: ${result.logs.length}`);
  console.log('\nÚltimos 5 logs:');
  result.logs.slice(-5).forEach(log => {
    console.log(`  ${log.prefix}`);
  });
}

// ============================================
// EJEMPLO 7: Integración con UI
// ============================================

async function example7_uiIntegration() {
  console.log('=== EJEMPLO 7: Integración con UI ===\n');

  // Simular obtener datos del formulario
  function getFormData() {
    return {
      path: document.getElementById('networkPath')?.value || '\\\\servidor\\compartida',
      username: document.getElementById('username')?.value || 'usuario',
      password: document.getElementById('password')?.value || 'contraseña',
      domain: document.getElementById('domain')?.value || '',
      pattern: document.getElementById('filePattern')?.value || '*.csv'
    };
  }

  // Simular mostrar resultado en UI
  function displayResult(result) {
    const resultContainer = document.getElementById('result');
    if (!resultContainer) {
      console.log('Resultado:', result);
      return;
    }

    if (result.status === 'READY') {
      resultContainer.innerHTML = `
        <div class="success">
          <h3>✔ Éxito</h3>
          <p>Archivo seleccionado: <strong>${result.selectedFile}</strong></p>
        </div>
      `;
    } else {
      resultContainer.innerHTML = `
        <div class="error">
          <h3>❌ Error</h3>
          <p>${result.message}</p>
        </div>
      `;
    }

    // Mostrar logs
    const logsContainer = document.getElementById('logs');
    if (logsContainer) {
      logsContainer.innerHTML = result.logs
        .map(log => `<div class="log log-${log.type}">${log.prefix}</div>`)
        .join('');
    }
  }

  // Simular click en botón
  async function handleDetectClick() {
    const formData = getFormData();
    const detector = new SMBFileDetector();
    const result = await detector.detect(formData);
    displayResult(result);
  }

  console.log('Función handleDetectClick() lista para usar');
  console.log('Vincula a un botón: onclick="handleDetectClick()"');
}

// ============================================
// EJECUTAR EJEMPLOS
// ============================================

// Descomenta el ejemplo que quieras ejecutar:

// example1_basicUsage();
// example2_withDomain();
// example3_exactPattern();
// example4_errorHandling();
// example5_patternValidation();
// example6_fullFlow();
// example7_uiIntegration();

console.log('Ejemplos disponibles:');
console.log('1. example1_basicUsage()');
console.log('2. example2_withDomain()');
console.log('3. example3_exactPattern()');
console.log('4. example4_errorHandling()');
console.log('5. example5_patternValidation()');
console.log('6. example6_fullFlow()');
console.log('7. example7_uiIntegration()');
