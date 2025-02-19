import { describe, it, expect, beforeEach } from "vitest"

// Mock the Clarity functions and types
const mockClarity = {
  tx: {
    sender: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  },
  types: {
    uint: (value: number) => ({ type: "uint", value }),
    principal: (value: string) => ({ type: "principal", value }),
    string: (value: string) => ({ type: "string", value }),
    bool: (value: boolean) => ({ type: "bool", value }),
  },
}

// Mock contract state
let lastDataId = 0
const sensorData = new Map()
const dataAccess = new Map()

// Mock contract calls
const contractCalls = {
  "store-data": (deviceId: number, dataType: string, value: string, isPublic: boolean) => {
    const dataId = ++lastDataId
    sensorData.set(dataId, {
      "device-id": mockClarity.types.uint(deviceId),
      timestamp: mockClarity.types.uint(100), // Mock block height
      "data-type": mockClarity.types.string(dataType),
      value: mockClarity.types.string(value),
      "is-public": mockClarity.types.bool(isPublic),
    })
    return { success: true, value: mockClarity.types.uint(dataId) }
  },
  "grant-data-access": (dataId: number, accessor: string) => {
    dataAccess.set(`${dataId}-${accessor}`, { allowed: mockClarity.types.bool(true) })
    return { success: true, value: true }
  },
  "revoke-data-access": (dataId: number, accessor: string) => {
    dataAccess.set(`${dataId}-${accessor}`, { allowed: mockClarity.types.bool(false) })
    return { success: true, value: true }
  },
  "get-data": (dataId: number) => {
    const data = sensorData.get(dataId)
    if (!data) {
      return { success: false, error: "err-not-found" }
    }
    if (
        !data["is-public"].value &&
        mockClarity.tx.sender !== "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" &&
        !dataAccess.get(`${dataId}-${mockClarity.tx.sender}`)?.allowed.value
    ) {
      return { success: false, error: "err-unauthorized" }
    }
    return { success: true, value: data }
  },
}

describe("Data Contract", () => {
  beforeEach(() => {
    lastDataId = 0
    sensorData.clear()
    dataAccess.clear()
  })
  
  it("should store sensor data", () => {
    const result = contractCalls["store-data"](1, "temperature", "25.5", true)
    expect(result.success).toBe(true)
    expect(result.value).toEqual(mockClarity.types.uint(1))
    
    const data = sensorData.get(1)
    expect(data).toBeDefined()
    expect(data["data-type"]).toEqual(mockClarity.types.string("temperature"))
    expect(data.value).toEqual(mockClarity.types.string("25.5"))
  })
  
  it("should grant data access", () => {
    contractCalls["store-data"](1, "temperature", "25.5", false)
    const result = contractCalls["grant-data-access"](1, "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
    expect(result.success).toBe(true)
    expect(result.value).toBe(true)
    
    const access = dataAccess.get("1-ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
    expect(access).toEqual({ allowed: mockClarity.types.bool(true) })
  })
  
  it("should revoke data access", () => {
    contractCalls["store-data"](1, "temperature", "25.5", false)
    contractCalls["grant-data-access"](1, "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
    const result = contractCalls["revoke-data-access"](1, "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
    expect(result.success).toBe(true)
    expect(result.value).toBe(true)
    
    const access = dataAccess.get("1-ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
    expect(access).toEqual({ allowed: mockClarity.types.bool(false) })
  })
  
  it("should get public data", () => {
    contractCalls["store-data"](1, "temperature", "25.5", true)
    const result = contractCalls["get-data"](1)
    expect(result.success).toBe(true)
    expect(result.value["data-type"]).toEqual(mockClarity.types.string("temperature"))
    expect(result.value.value).toEqual(mockClarity.types.string("25.5"))
  })
  
  it("should get private data with access", () => {
    contractCalls["store-data"](1, "humidity", "60", false)
    contractCalls["grant-data-access"](1, mockClarity.tx.sender)
    const result = contractCalls["get-data"](1)
    expect(result.success).toBe(true)
    expect(result.value["data-type"]).toEqual(mockClarity.types.string("humidity"))
    expect(result.value.value).toEqual(mockClarity.types.string("60"))
  })
  
  it("should fail to get private data without access", () => {
    contractCalls["store-data"](1, "pressure", "1013", false)
    mockClarity.tx.sender = "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
    const result = contractCalls["get-data"](1)
    expect(result.success).toBe(false)
    expect(result.error).toBe("err-unauthorized")
  })
  
  it("should fail to get non-existent data", () => {
    const result = contractCalls["get-data"](999)
    expect(result.success).toBe(false)
    expect(result.error).toBe("err-not-found")
  })
})

