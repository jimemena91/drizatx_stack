import { describe, expect, it } from "vitest"

import {
  ensureSmsPhoneNumber,
  normalizeArgentinaPhoneNumber,
  stripToDigits,
} from "@/lib/phone-utils"

describe("stripToDigits", () => {
  it("removes non numeric characters", () => {
    expect(stripToDigits("+54 (9) 11-5123-4567")).toBe("5491151234567")
  })
})

describe("normalizeArgentinaPhoneNumber", () => {
  it("normalizes local number with 0 and 15 prefix", () => {
    expect(normalizeArgentinaPhoneNumber("011 15 5123-4567")).toBe("+5491151234567")
  })

  it("normalizes numbers from provinces with 3-digit area codes", () => {
    expect(normalizeArgentinaPhoneNumber("0351 15 1234567")).toBe("+5493511234567")
  })

  it("normalizes numbers from provinces with 4-digit area codes", () => {
    expect(normalizeArgentinaPhoneNumber("02966 15 123456")).toBe("+5492966123456")
  })

  it("adds the mobile prefix when only +54 is provided", () => {
    expect(normalizeArgentinaPhoneNumber("+54 11 5123 4567")).toBe("+5491151234567")
  })

  it("keeps already normalized numbers intact", () => {
    expect(normalizeArgentinaPhoneNumber("+5493515123456")).toBe("+5493515123456")
  })

  it("handles international prefix 0054", () => {
    expect(normalizeArgentinaPhoneNumber("0054 9 223 512 3456")).toBe("+5492235123456")
  })

  it("handles numbers that already include the mobile prefix without country code", () => {
    expect(normalizeArgentinaPhoneNumber("91151234567")).toBe("+5491151234567")
  })

  it("returns empty string for invalid values", () => {
    expect(normalizeArgentinaPhoneNumber("")).toBe("")
    expect(normalizeArgentinaPhoneNumber("abc")).toBe("")
    expect(normalizeArgentinaPhoneNumber("+54")).toBe("")
  })
})

describe("ensureSmsPhoneNumber", () => {
  it("returns normalized phone when valid", () => {
    expect(ensureSmsPhoneNumber("+54 9 351 512 3456")).toBe("+5493515123456")
  })

  it("returns null for invalid phone", () => {
    expect(ensureSmsPhoneNumber("123")).toBeNull()
    expect(ensureSmsPhoneNumber("+54")).toBeNull()
    expect(ensureSmsPhoneNumber(null)).toBeNull()
  })
})
