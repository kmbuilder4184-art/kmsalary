<?php
/**
 * Date-wise student attendance sync using eSSL GetTransactionsLog.
 * Fetches machine punches for a requested date range, saves each punch once,
 * and returns rows grouped by date with student name/class when mapped in DB.
 *
 * Requirements: PHP 8+, PDO MySQL extension, cURL extension.
 * Configure secrets as environment variables; do not commit them.
 *
 * Environment:
 *   DB_DSN="mysql:host=127.0.0.1;dbname=school;charset=utf8mb4"
 *   DB_USER="school_app"
 *   DB_PASSWORD="..."
 *   ESSL_API_URL="https://isopentyl-immersed-cecelia.ngrok-free.dev//iclock/WebAPIService.asmx"
 *   ESSL_USERNAME="api"
 *   ESSL_PASSWORD="set this in the server environment"
 *   ESSL_SERIAL_NUMBER="TBS2262000975"
 *
 * Run once in MySQL:
 * CREATE TABLE student_attendance_punches (
 *   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 *   device_serial VARCHAR(80) NOT NULL,
 *   biometric_id VARCHAR(80) NOT NULL,
 *   punched_at DATETIME NOT NULL,
 *   raw_line TEXT NULL,
 *   created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 *   UNIQUE KEY uq_device_user_punch (device_serial, biometric_id, punched_at),
 *   KEY ix_punched_at (punched_at),
 *   KEY ix_biometric_id (biometric_id)
 * ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
 *
 * Request:
 *   GET /essl-student-attendance-report.php?fromDate=2026-10-01&toDate=2026-10-10
 * The inclusive end date is automatically expanded to 23:59:59.
 */

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

function respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function requiredEnv(string $name): string
{
    $value = getenv($name);
    if ($value === false || trim($value) === '') {
        throw new RuntimeException("Missing environment variable: {$name}");
    }
    return trim($value);
}

function xmlEscape(string $value): string
{
    return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

function xmlValue(string $xml, string $tag): string
{
    $tag = preg_quote($tag, '~');
    if (!preg_match('~<(?:\w+:)?' . $tag . '\b[^>]*>(.*?)</(?:\w+:)?' . $tag . '>~si', $xml, $match)) {
        return '';
    }
    return html_entity_decode(strip_tags($match[1]), ENT_QUOTES | ENT_XML1, 'UTF-8');
}

function requireIsoDate(string $value, string $field): DateTimeImmutable
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    $errors = DateTimeImmutable::getLastErrors();
    if (!$date || ($errors && ($errors['warning_count'] || $errors['error_count'])) || $date->format('Y-m-d') !== $value) {
        throw new InvalidArgumentException("{$field} must use YYYY-MM-DD format.");
    }
    return $date;
}

function callGetTransactionsLog(string $from, string $to, string $serial, string $username, string $password, string $url): string
{
    $soap = '<?xml version="1.0" encoding="utf-8"?>'
        . '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
        . '<soap:Body><GetTransactionsLog xmlns="http://tempuri.org/">'
        . '<FromDateTime>' . $from . '</FromDateTime>'
        . '<ToDateTime>' . $to . '</ToDateTime>'
        . '<SerialNumber>' . xmlEscape($serial) . '</SerialNumber>'
        . '<UserName>' . xmlEscape($username) . '</UserName>'
        . '<UserPassword>' . xmlEscape($password) . '</UserPassword>'
        . '<strDataList></strDataList>'
        . '</GetTransactionsLog></soap:Body></soap:Envelope>';

    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $soap,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => [
            'Content-Type: text/xml; charset=utf-8',
            'SOAPAction: "http://tempuri.org/GetTransactionsLog"',
        ],
    ]);
    $xml = curl_exec($curl);
    $curlError = curl_error($curl);
    $httpCode = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);

    if ($xml === false) {
        throw new RuntimeException('Could not connect to eSSL: ' . $curlError);
    }
    if ($httpCode < 200 || $httpCode >= 300) {
        throw new RuntimeException("eSSL returned HTTP {$httpCode}.");
    }
    $fault = xmlValue((string) $xml, 'faultstring');
    if ($fault !== '') {
        throw new RuntimeException('eSSL SOAP fault: ' . $fault);
    }
    return (string) $xml;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        header('Allow: GET');
        respond(405, ['success' => false, 'message' => 'Use GET with fromDate and toDate.']);
    }
    $fromDate = requireIsoDate((string) ($_GET['fromDate'] ?? ''), 'fromDate');
    $toDate = requireIsoDate((string) ($_GET['toDate'] ?? ''), 'toDate');
    if ($toDate < $fromDate) {
        respond(400, ['success' => false, 'message' => 'toDate must be on or after fromDate.']);
    }
    if ($toDate->diff($fromDate)->days > 92) {
        respond(400, ['success' => false, 'message' => 'Choose a date range of 93 days or less.']);
    }

    // Defaults match the supplied student machine. Environment variables may
    // override the URL and serial if eSSL/ngrok settings change later.
    $serial = getenv('ESSL_SERIAL_NUMBER') ?: 'TBS2262000975';
    $apiUrl = getenv('ESSL_API_URL') ?: 'https://isopentyl-immersed-cecelia.ngrok-free.dev//iclock/WebAPIService.asmx';
    $apiUsername = getenv('ESSL_USERNAME') ?: 'api';
    $apiPassword = requiredEnv('ESSL_PASSWORD');
    $xml = callGetTransactionsLog(
        $fromDate->format('Y-m-d'),
        $toDate->format('Y-m-d') . ' 23:59:59',
        $serial,
        $apiUsername,
        $apiPassword,
        $apiUrl
    );
    $rawLogs = xmlValue($xml, 'strDataList');
    $logs = [];
    foreach (preg_split('/\r?\n/', trim($rawLogs)) ?: [] as $line) {
        $parts = array_map('trim', explode("\t", trim($line)));
        if (count($parts) < 2 || $parts[0] === '' || $parts[1] === '') {
            continue;
        }
        $dateTime = date_create($parts[1]);
        if (!$dateTime) {
            continue;
        }
        $logs[] = [
            'biometric_id' => $parts[0],
            'punched_at' => $dateTime->format('Y-m-d H:i:s'),
            'raw_line' => $line,
        ];
    }

    $pdo = new PDO(requiredEnv('DB_DSN'), requiredEnv('DB_USER'), requiredEnv('DB_PASSWORD'), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    // Unique key makes repeated date-range syncs safe; duplicate punches are ignored.
    $insert = $pdo->prepare('INSERT IGNORE INTO student_attendance_punches (device_serial, biometric_id, punched_at, raw_line) VALUES (?, ?, ?, ?)');
    $pdo->beginTransaction();
    foreach ($logs as $log) {
        $insert->execute([$serial, $log['biometric_id'], $log['punched_at'], $log['raw_line']]);
    }
    $pdo->commit();

    // Student names/classes are mapped from the app's students table by biometric_id.
    $reportQuery = $pdo->prepare(
        'SELECT p.biometric_id, p.punched_at, s.name AS student_name, s.class_name, s.section
         FROM student_attendance_punches p
         LEFT JOIN students s ON s.biometric_id = p.biometric_id
         WHERE p.device_serial = ? AND p.punched_at >= ? AND p.punched_at <= ?
         ORDER BY DATE(p.punched_at), COALESCE(s.name, p.biometric_id), p.punched_at'
    );
    $reportQuery->execute([
        $serial,
        $fromDate->format('Y-m-d') . ' 00:00:00',
        $toDate->format('Y-m-d') . ' 23:59:59',
    ]);
    $byDate = [];
    $unmatchedIds = [];
    foreach ($reportQuery->fetchAll() as $row) {
        $date = substr($row['punched_at'], 0, 10);
        if (!$row['student_name']) {
            $unmatchedIds[$row['biometric_id']] = true;
        }
        $byDate[$date][] = [
            'biometricId' => $row['biometric_id'],
            'studentName' => $row['student_name'] ?: null,
            'class' => $row['class_name'] ?: null,
            'section' => $row['section'] ?: null,
            'punchTime' => substr($row['punched_at'], 11, 8),
        ];
    }

    respond(200, [
        'success' => true,
        'machineSerial' => $serial,
        'fromDate' => $fromDate->format('Y-m-d'),
        'toDate' => $toDate->format('Y-m-d'),
        'punchesFetched' => count($logs),
        'attendanceByDate' => $byDate,
        'unmatchedBiometricIds' => array_keys($unmatchedIds),
        'note' => 'Only date-wise machine punches are reported. Profiles without a matching students.biometric_id appear with studentName=null.',
    ]);
} catch (InvalidArgumentException $error) {
    respond(400, ['success' => false, 'message' => $error->getMessage()]);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('eSSL attendance report failed: ' . $error->getMessage());
    respond(500, ['success' => false, 'message' => $error->getMessage()]);
}
