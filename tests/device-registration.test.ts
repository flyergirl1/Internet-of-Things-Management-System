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
    list: (value: any[]) => ({ type: "list", value }),
  },
}

// Mock contract state
const developments = new Map()

// Mock land parcel contract calls
const mockLandParcelContract = {
  "get-land-parcel-owner": (parcelId: number) => {
    return { success: true, value: mockClarity.types.principal(mockClarity.tx.sender) }
  },
}

// Mock contract calls
const contractCalls = {
  "add-building": (parcelId: number, buildingType: string) => {
    const development = developments.get(parcelId) || { buildings: [], improvements: [], lastUpdated: 0 }
    if (development.buildings.length >= 5) {
      return { success: false, error: "err-unauthorized" }
    }
    development.buildings.push(buildingType)
    development.lastUpdated = Date.now()
    developments.set(parcelId, development)
    return { success: true, value: true }
  },
  "add-improvement": (parcelId: number, improvementType: string) => {
    const development = developments.get(parcelId) || { buildings: [], improvements: [], lastUpdated: 0 }
    if (development.improvements.length >= 10) {
      return { success: false, error: "err-unauthorized" }
    }
    development.improvements.push(improvementType)
    development.lastUpdated = Date.now()
    developments.set(parcelId, development)
    return { success: true, value: true }
  },
  "get-development": (parcelId: number) => {
    const development = developments.get(parcelId)
    return development
        ? {
          success: true,
          value: {
            buildings: mockClarity.types.list(development.buildings.map((b) => mockClarity.types.string(b))),
            improvements: mockClarity.types.list(development.improvements.map((i) => mockClarity.types.string(i))),
            "last-updated": mockClarity.types.uint(development.lastUpdated),
          },
        }
        : { success: false, error: "err-not-found" }
  },
}

describe("Development Contract", () => {
  beforeEach(() => {
    developments.clear()
  })
  
  it("should add a building to a land parcel", () => {
    const result = contractCalls["add-building"](1, "House")
    expect(result.success).toBe(true)
    expect(result.value).toBe(true)
    
    const development = developments.get(1)
    expect(development.buildings).toContain("House")
  })
  
  it("should add an improvement to a land parcel", () => {
    const result = contractCalls["add-improvement"](1, "Swimming Pool")
    expect(result.success).toBe(true)
    expect(result.value).toBe(true)
    
    const development = developments.get(1)
    expect(development.improvements).toContain("Swimming Pool")
  })
  
  it("should fail to add more than 5 buildings", () => {
    for (let i = 0; i < 5; i++) {
      contractCalls["add-building"](1, `Building ${i}`)
    }
    const result = contractCalls["add-building"](1, "Extra Building")
    expect(result.success).toBe(false)
    expect(result.error).toBe("err-unauthorized")
  })
  
  it("should fail to add more than 10 improvements", () => {
    for (let i = 0; i < 10; i++) {
      contractCalls["add-improvement"](1, `Improvement ${i}`)
    }
    const result = contractCalls["add-improvement"](1, "Extra Improvement")
    expect(result.success).toBe(false)
    expect(result.error).toBe("err-unauthorized")
  })
  
  it("should get development details", () => {
    contractCalls["add-building"](1, "House")
    contractCalls["add-improvement"](1, "Garden")
    const result = contractCalls["get-development"](1)
    expect(result.success).toBe(true)
    expect(result.value.buildings).toEqual(mockClarity.types.list([mockClarity.types.string("House")]))
    expect(result.value.improvements).toEqual(mockClarity.types.list([mockClarity.types.string("Garden")]))
    expect(result.value["last-updated"]).toBeDefined()
  })
  
  it("should fail to get development for non-existent parcel", () => {
    const result = contractCalls["get-development"](999)
    expect(result.success).toBe(false)
    expect(result.error).toBe("err-not-found")
  })
})

