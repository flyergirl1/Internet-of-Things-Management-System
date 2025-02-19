;; Data Contract

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-unauthorized (err u102))

;; Data Variables
(define-data-var last-data-id uint u0)

;; Data Maps
(define-map sensor-data
  { data-id: uint }
  {
    device-id: uint,
    timestamp: uint,
    data-type: (string-ascii 20),
    value: (string-utf8 100),
    is-public: bool
  }
)

(define-map data-access
  { data-id: uint, principal: principal }
  { allowed: bool }
)

;; Public Functions

;; Store sensor data
(define-public (store-data (device-id uint) (data-type (string-ascii 20)) (value (string-utf8 100)) (is-public bool))
  (let
    (
      (data-id (+ (var-get last-data-id) u1))
    )
    (map-set sensor-data
      { data-id: data-id }
      {
        device-id: device-id,
        timestamp: block-height,
        data-type: data-type,
        value: value,
        is-public: is-public
      }
    )
    (var-set last-data-id data-id)
    (ok data-id)
  )
)

;; Grant data access to a principal
(define-public (grant-data-access (data-id uint) (accessor principal))
  (let
    (
      (data (unwrap! (map-get? sensor-data { data-id: data-id }) err-not-found))
      (device (unwrap! (contract-call? .device-registration get-device (get device-id data)) err-not-found))
    )
    (asserts! (is-eq tx-sender (get owner device)) err-owner-only)
    (ok (map-set data-access
      { data-id: data-id, principal: accessor }
      { allowed: true }
    ))
  )
)

;; Revoke data access from a principal
(define-public (revoke-data-access (data-id uint) (accessor principal))
  (let
    (
      (data (unwrap! (map-get? sensor-data { data-id: data-id }) err-not-found))
      (device (unwrap! (contract-call? .device-registration get-device (get device-id data)) err-not-found))
    )
    (asserts! (is-eq tx-sender (get owner device)) err-owner-only)
    (ok (map-set data-access
      { data-id: data-id, principal: accessor }
      { allowed: false }
    ))
  )
)

;; Read-only Functions

;; Get sensor data
(define-read-only (get-data (data-id uint))
  (let
    (
      (data (unwrap! (map-get? sensor-data { data-id: data-id }) err-not-found))
    )
    (asserts! (or
      (get is-public data)
      (is-eq tx-sender contract-owner)
      (get allowed (default-to { allowed: false } (map-get? data-access { data-id: data-id, principal: tx-sender })))
    ) err-unauthorized)
    (ok data)
  )
)

;; Initialize contract
(begin
  (var-set last-data-id u0)
)

