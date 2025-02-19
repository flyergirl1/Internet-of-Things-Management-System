;; Device Registration Contract

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-already-registered (err u102))

;; Data Variables
(define-data-var last-device-id uint u0)

;; Data Maps
(define-map devices
  { device-id: uint }
  {
    owner: principal,
    device-type: (string-ascii 50),
    name: (string-utf8 100),
    public-key: (buff 33),
    registered-at: uint,
    last-active: uint
  }
)

(define-map device-permissions
  { device-id: uint, permission: (string-ascii 20) }
  { allowed: bool }
)

;; Public Functions

;; Register a new IoT device
(define-public (register-device (device-type (string-ascii 50)) (name (string-utf8 100)) (public-key (buff 33)))
  (let
    (
      (device-id (+ (var-get last-device-id) u1))
    )
    (asserts! (is-none (map-get? devices { device-id: device-id })) err-already-registered)
    (map-set devices
      { device-id: device-id }
      {
        owner: tx-sender,
        device-type: device-type,
        name: name,
        public-key: public-key,
        registered-at: block-height,
        last-active: block-height
      }
    )
    (var-set last-device-id device-id)
    (ok device-id)
  )
)

;; Update device status (last active timestamp)
(define-public (update-device-status (device-id uint))
  (let
    (
      (device (unwrap! (map-get? devices { device-id: device-id }) err-not-found))
    )
    (asserts! (is-eq tx-sender (get owner device)) err-owner-only)
    (ok (map-set devices
      { device-id: device-id }
      (merge device { last-active: block-height })
    ))
  )
)

;; Set device permission
(define-public (set-device-permission (device-id uint) (permission (string-ascii 20)) (allowed bool))
  (let
    (
      (device (unwrap! (map-get? devices { device-id: device-id }) err-not-found))
    )
    (asserts! (is-eq tx-sender (get owner device)) err-owner-only)
    (ok (map-set device-permissions
      { device-id: device-id, permission: permission }
      { allowed: allowed }
    ))
  )
)

;; Read-only Functions

;; Get device details
(define-read-only (get-device (device-id uint))
  (ok (unwrap! (map-get? devices { device-id: device-id }) err-not-found))
)

;; Check device permission
(define-read-only (check-device-permission (device-id uint) (permission (string-ascii 20)))
  (default-to
    { allowed: false }
    (map-get? device-permissions { device-id: device-id, permission: permission })
  )
)

;; Initialize contract
(begin
  (var-set last-device-id u0)
)

