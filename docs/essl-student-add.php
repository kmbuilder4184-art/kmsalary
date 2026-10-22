<?php
/**
 * eSSL student profile example: insert/update a local MySQL record, then queue
 * that student's basic profile on the eTimeTrackLite server using AddEmployee.
 *
 * Requirements: PHP 8+, PDO MySQL extension, cURL extension.
 * Keep credentials in environment variables; never commit them to source control.
 *
 * Example environment:
 *   DB_DSN="mysql:host=127.0.0.1;dbname=school;charset=utf8mb4"
 *   DB_USER="school_app"
 *   DB_PASSWORD="..."
 *   ESSL_API_URL="https://your-host/iclock/WebAPIService.asmx"
 *   ESSL_API_KEY="..."
 *   ESSL_USERNAME="..."
 *   ESSL_PASSWORD="..."
 *   ESSL_SERIAL_NUMBER="TBS2262000975"
 *
 * Example table (run once):
 * CREATE TABLE students (
 *   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 *   biometric_id VARCHAR(80) NOT NULL UNIQUE,
 *   student_code VARCHAR(40) NOT NULL DEFAULT '',
 *   name VARCHAR(120) NOT NULL,
 *   class_name VARCHAR(60) NOT NULL,
 *   section VARCHAR(30) NOT NULL DEFAULT '',
 *   guardian_name VARCHAR(120) NOT NULL DEFAULT '',
 *   phone VARCHAR(30) NOT NULL DEFAULT '',
 *   created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 *   updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 * ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
 *
 * POST JSON to this file, for example:
 * {"biometricId":"123456","studentCode":"123456","name":"Sample Student",
 *  "className":"Class 9","section":"A","guardianName":"","phone":""}
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function respond(int $status, array $data): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function envRequired(string $key): string
{
    $value = getenv($key);
    if ($value === false || trim($value) === '') {
        throw new RuntimeException("Missing required environment variable: {$key}");
    }
    return trim($value);
}

function xmlEscape(string $value): string
{
    return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

function soapValue(string $xml, string $tag): string
{
    if (!preg_match('~<(?:\w+:)?' . preg_quote($tag, '~') . '\b[^>]*>(.*?)</(?:\w+:)?' . preg_quote($tag, '~') . '>~si', $xml, $match)) {
        return '';
    }
    return html_entity_decode(strip_tags($match[1]), ENT_QUOTES | ENT_XML1, 'UTF-8');
}

function postSoap(string $url, string $action, string $body): string
{
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => [
            'Content-Type: text/xml; charset=utf-8',
            'SOAPAction: "http://tempuri.org/' . $action . '"',
        ],
    ]);
    $response = curl_exec($curl);
    $curlError = curl_error($curl);
    $httpCode = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);

    if ($response === false) {
        throw new RuntimeException('Could not connect to eSSL server: ' . $curlError);
    }
    if ($httpCode < 200 || $httpCode >= 300) {
        throw new RuntimeException("eSSL HTTP error {$httpCode}: " . substr((string) $response, 0, 500));
    }
    if (soapValue((string) $response, 'faultstring') !== '') {
        throw new RuntimeException('eSSL SOAP fault: ' . soapValue((string) $response, 'faultstring'));
    }
    return (string) $response;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['success' => false, 'message' => 'Use POST with a JSON student object.']);
}

try {
    $input = json_decode((string) file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($input)) {
        respond(400, ['success' => false, 'message' => 'Request body must be a JSON object.']);
    }

    $student = [
        'biometric_id' => trim((string) ($input['biometricId'] ?? '')),
        'student_code' => trim((string) ($input['studentCode'] ?? '')),
        'name' => trim((string) ($input['name'] ?? '')),
        'class_name' => trim((string) ($input['className'] ?? '')),
        'section' => trim((string) ($input['section'] ?? '')),
        'guardian_name' => trim((string) ($input['guardianName'] ?? '')),
        'phone' => trim((string) ($input['phone'] ?? '')),
    ];

    foreach (['biometric_id', 'name', 'class_name'] as $required) {
        if ($student[$required] === '') {
            respond(400, ['success' => false, 'message' => "Missing required field: {$required}"]);
        }
    }
    if (mb_strlen($student['biometric_id']) > 80 || mb_strlen($student['name']) > 120 || mb_strlen($student['class_name']) > 60) {
        respond(400, ['success' => false, 'message' => 'A field exceeds its allowed length.']);
    }

    // Insert/update by unique biometric ID so retrying does not create duplicate students.
    $pdo = new PDO(envRequired('DB_DSN'), envRequired('DB_USER'), envRequired('DB_PASSWORD'), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $sql = 'INSERT INTO students (biometric_id, student_code, name, class_name, section, guardian_name, phone)
            VALUES (:biometric_id, :student_code, :name, :class_name, :section, :guardian_name, :phone)
            ON DUPLICATE KEY UPDATE student_code = VALUES(student_code), name = VALUES(name),
              class_name = VALUES(class_name), section = VALUES(section),
              guardian_name = VALUES(guardian_name), phone = VALUES(phone), updated_at = CURRENT_TIMESTAMP';
    $statement = $pdo->prepare($sql);
    $statement->execute($student);

    // Build the same AddEmployee SOAP fields used by the software's student send action.
    $config = [
        'url' => envRequired('ESSL_API_URL'),
        'apiKey' => envRequired('ESSL_API_KEY'),
        'username' => envRequired('ESSL_USERNAME'),
        'password' => envRequired('ESSL_PASSWORD'),
        'serial' => envRequired('ESSL_SERIAL_NUMBER'),
    ];
    $commandId = (string) random_int(100000000, 2147483646);
    $employeeCode = $student['biometric_id'];
    $cardNumber = $student['student_code'] !== '' ? $student['student_code'] : $student['biometric_id'];
    $soap = '<?xml version="1.0" encoding="utf-8"?>'
        . '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
        . '<soap:Body><AddEmployee xmlns="http://tempuri.org/">'
        . '<APIKey>' . xmlEscape($config['apiKey']) . '</APIKey>'
        . '<EmployeeCode>' . xmlEscape($employeeCode) . '</EmployeeCode>'
        . '<EmployeeName>' . xmlEscape($student['name']) . '</EmployeeName>'
        . '<CardNumber>' . xmlEscape($cardNumber) . '</CardNumber>'
        . '<SerialNumber>' . xmlEscape($config['serial']) . '</SerialNumber>'
        . '<UserName>' . xmlEscape($config['username']) . '</UserName>'
        . '<UserPassword>' . xmlEscape($config['password']) . '</UserPassword>'
        . '<CommandId>' . $commandId . '</CommandId>'
        . '</AddEmployee></soap:Body></soap:Envelope>';

    $xml = postSoap($config['url'], 'AddEmployee', $soap);
    $result = trim(soapValue($xml, 'AddEmployeeResult'));
    if ($result === '') {
        respond(502, [
            'success' => false,
            'profileSaved' => true,
            'commandId' => $commandId,
            'message' => 'Student DB mein save hua, lekin eSSL response mein AddEmployeeResult nahi mila.',
        ]);
    }
    if (preg_match('/fail|invalid|error|denied|not found|unauthori[sz]ed|unathori[sz]ed|^(false|0)$/i', $result)) {
        respond(502, [
            'success' => false,
            'profileSaved' => true,
            'commandId' => $commandId,
            'machineResult' => $result,
            'message' => 'Student DB mein save hua, lekin eSSL ne command reject ki.',
        ]);
    }

    respond(200, [
        'success' => true,
        'profileSaved' => true,
        'commandQueued' => true,
        'machineSerial' => $config['serial'],
        'commandId' => soapValue($xml, 'CommandId') ?: $commandId,
        'machineResult' => $result,
        'message' => 'eSSL server ne AddEmployee request accept ki. Device par profile process hui hai ya nahi, GetCommandStatus se verify karein.',
    ]);
} catch (JsonException $error) {
    respond(400, ['success' => false, 'message' => 'Invalid JSON request body.']);
} catch (Throwable $error) {
    error_log('Student/eSSL insert failed: ' . $error->getMessage());
    respond(500, ['success' => false, 'message' => $error->getMessage()]);
}
