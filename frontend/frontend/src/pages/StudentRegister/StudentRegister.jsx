import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.js'
import '../auth.css'
import './StudentRegister.css'

const VALID_BRANCH_CODES = ['02', '03', '04', '05', '12', '42', '45', '46']
const REGISTER_BRANCH_NAMES = {
  '02': 'EEE',
  '03': 'MECH',
  '04': 'ECE',
  '05': 'CSE',
  '12': 'IT',
  '42': 'ML',
  '45': 'DS',
  '46': 'CYBER',
}
const REGISTER_NUMBER_REGEX = /^(\d{2})B01A(\d{2})([A-Z0-9]{2})$/
const PHONE_REGEX = /^[6-9]\d{9}$/
const AADHAR_REGEX = /^\d{12}$/
const PINCODE_REGEX = /^\d{6}$/
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const CATEGORY_OPTIONS = ['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'SC', 'ST']
const STAY_TYPE_OPTIONS = ['Day Scholar', 'Hosteler']
const BRANCH_OPTIONS = [
  { value: 'CSE', label: 'Computer Science & Engineering' },
  { value: 'IT', label: 'Information Technology' },
  { value: 'ECE', label: 'Electronics & Communication' },
  { value: 'EEE', label: 'Electrical & Electronics' },
  { value: 'MECH', label: 'Mechanical Engineering' },
  { value: 'ML', label: 'Machine Learning' },
  { value: 'DS', label: 'Data Science' },
  { value: 'CYBER', label: 'Cyber Security' },
]

const initialForm = {
  full_name: '',
  register_number: '',
  date_of_birth: '',
  phone: '',
  alt_email: '',
  category: '',
  course: '',
  batch: '',
  branch: '',
  section: '',
  father_name: '',
  father_occupation: '',
  mother_name: '',
  mother_maiden_name: '',
  parent_mobile_no: '',
  address_for_communication: '',
  hometown: '',
  district: '',
  state: '',
  pincode: '',
  stay_type: '',
  aadhar_no: '',
  name_as_per_aadhar: '',
  pan_number: '',
  password: '',
  confirm_password: '',
}

function getRegisterNumberError(rawValue) {
  const value = rawValue.trim().toUpperCase()
  const match = value.match(REGISTER_NUMBER_REGEX)
  if (!match) {
    return 'Format should be like 24B01A1286 (YY + B01A + branch code + roll).'
  }
  const branchCode = match[2]
  if (!VALID_BRANCH_CODES.includes(branchCode)) {
    return `'${branchCode}' is not a recognized branch code.`
  }
  return null
}

function getGeneratedEmailPreview(rawValue) {
  const value = rawValue.trim()
  if (getRegisterNumberError(value)) return ''
  return `${value.toLowerCase()}@svecw.edu.in`
}

function validatePassword(password) {
  if (password.length < 8) {
    return 'At least 8 characters.'
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    return 'Include an uppercase letter, a lowercase letter, and a number.'
  }
  return ''
}

function parseRegisterNumber(value) {
  const normalized = value.trim().toUpperCase()
  const match = normalized.match(REGISTER_NUMBER_REGEX)
  if (!match) return null
  const admissionYear = Number(match[1])
  const branchCode = match[2]
  const branchName = REGISTER_BRANCH_NAMES[branchCode]
  const graduationYear = 2000 + admissionYear + 4
  return { normalized, branchCode, branchName, graduationYear }
}

function validateStep(step, form, otp, otpVerified) {
  const errors = {}

  if (step === 1) {
    if (form.full_name.trim().length < 2) errors.full_name = 'Enter your full name.'
    const registerNumberError = getRegisterNumberError(form.register_number)
    if (registerNumberError) errors.register_number = registerNumberError
    if (!form.date_of_birth) errors.date_of_birth = 'Select your date of birth.'
    if (!PHONE_REGEX.test(form.phone.trim())) errors.phone = 'Enter a valid 10-digit mobile number.'
    if (!form.alt_email || !EMAIL_REGEX.test(form.alt_email.trim())) {
      errors.alt_email = 'Enter a valid alternative email address.'
    } else if (!otpVerified) {
      errors.alt_email = 'Verify your alternative email before continuing.'
    }
    if (!form.category) errors.category = 'Choose a category.'
  }

  if (step === 2) {
    if (!form.course.trim()) errors.course = 'Enter your course.'
    if (!form.batch.trim()) errors.batch = 'Enter your batch.'
    if (!form.branch.trim()) errors.branch = 'Select your branch.'
    if (!form.section.trim()) errors.section = 'Enter your section.'
  }

  if (step === 3) {
    if (form.father_name.trim().length < 2) errors.father_name = 'Enter your father’s name.'
    if (form.father_occupation.trim().length < 2) errors.father_occupation = 'Enter your father’s occupation.'
    if (form.mother_name.trim().length < 2) errors.mother_name = 'Enter your mother’s name.'
    if (form.mother_maiden_name.trim().length < 2) errors.mother_maiden_name = 'Enter your mother’s maiden name.'
    if (!PHONE_REGEX.test(form.parent_mobile_no.trim())) {
      errors.parent_mobile_no = 'Enter a valid 10-digit parent mobile number.'
    }
  }

  if (step === 4) {
    if (form.address_for_communication.trim().length < 5) errors.address_for_communication = 'Enter your communication address.'
    if (form.hometown.trim().length < 2) errors.hometown = 'Enter your hometown.'
    if (form.district.trim().length < 2) errors.district = 'Enter your district.'
    if (form.state.trim().length < 2) errors.state = 'Enter your state.'
    if (!PINCODE_REGEX.test(form.pincode.trim())) errors.pincode = 'Enter a valid 6-digit pincode.'
    if (!form.stay_type) errors.stay_type = 'Choose stay type.'
  }

  if (step === 5) {
    if (!AADHAR_REGEX.test(form.aadhar_no.trim())) errors.aadhar_no = 'Enter a valid 12-digit Aadhar number.'
    if (form.name_as_per_aadhar.trim().length < 2) errors.name_as_per_aadhar = 'Enter the name as per Aadhar.'
    if (form.pan_number && form.pan_number.trim().length < 5) {
      errors.pan_number = 'Enter a valid PAN number if you provide one.'
    }
    const passwordError = validatePassword(form.password)
    if (passwordError) errors.password = passwordError
    if (form.confirm_password !== form.password) errors.confirm_password = 'Passwords do not match.'
  }

  if (step === 6 && !/^[0-9]{6}$/.test(otp)) {
    errors.otp = 'Enter the 6-digit OTP.'
  }

  return errors
}

function StudentRegister() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [otp, setOtp] = useState('')
  const [copied, setCopied] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [apiError, setApiError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [approvedBranches, setApprovedBranches] = useState([])
  const [approvedBatches, setApprovedBatches] = useState([])
  const [academicLoaded, setAcademicLoaded] = useState(false)
  const [academicFetchError, setAcademicFetchError] = useState('')
  const [academicValidated, setAcademicValidated] = useState(false)

  function normalizeChange(name, value) {
    if (name === 'register_number') return value.toUpperCase().trim()
    if (name === 'alt_email') return value.trim().toLowerCase()
    if (name === 'pan_number') return value.toUpperCase().trim()
    if (name === 'phone' || name === 'parent_mobile_no') return value.replace(/\D/g, '').slice(0, 10)
    if (name === 'pincode') return value.replace(/\D/g, '').slice(0, 6)
    if (name === 'aadhar_no') return value.replace(/\D/g, '').slice(0, 12)
    return value
  }

  function getRegisterNumberAcademicError(value) {
    const parsed = parseRegisterNumber(value)
    if (!parsed) return null
    if (!academicLoaded || !academicValidated) return null

    const branchApproved = approvedBranches.some(
      (branch) => String(branch.code).trim().toLowerCase() === String(parsed.branchName).trim().toLowerCase(),
    )
    if (!branchApproved) {
      return `Your branch (${parsed.branchName || 'unknown'}) is not approved for registration. Please contact the placement cell.`
    }

    const batchApproved = approvedBatches.some(
      (batch) => Number(batch.graduation_year) === parsed.graduationYear,
    )
    if (!batchApproved) {
      return `Your batch (${parsed.graduationYear}) is not approved for registration. Please contact the placement cell.`
    }

    return null
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: normalizeChange(name, value) }))
    if (name === 'alt_email') {
      setOtpSent(false)
      setOtpVerified(false)
      setOtp('')
    }
  }

  async function handleCopyEmail() {
    const emailPreview = getGeneratedEmailPreview(form.register_number)
    if (!emailPreview) return
    try {
      await navigator.clipboard.writeText(emailPreview)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      // ignore clipboard failures silently
    }
  }

  async function submitRegistration() {
    setIsSubmitting(true)
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ''))
      const response = await api.post('/auth/student/register', payload)
      setApiError('')
      setErrors({})
      setSuccessMessage(`Account created for ${response.data.full_name}. You can now log in.`)
      setStep(6)
    } catch (err) {
      const detail = err.response?.data?.detail
      setApiError(Array.isArray(detail) ? detail.map((d) => d.msg).join(' ') : detail || 'Unable to complete registration. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleNext(e) {
    e.preventDefault()
    const validationErrors = validateStep(step, form, otp, otpVerified)
    setErrors(validationErrors)
    setApiError('')
    if (Object.keys(validationErrors).length > 0) return

    if (step === 1) {
      const academicError = getRegisterNumberAcademicError(form.register_number)
      if (academicError) {
        setApiError(academicError)
        return
      }
    }

    if (step === 5) {
      await submitRegistration()
      return
    }

    setStep((prev) => prev + 1)
  }

  async function sendOtp() {
    if (!form.alt_email || !EMAIL_REGEX.test(form.alt_email.trim())) {
      setApiError('Enter a valid alternative email address before sending OTP.')
      return
    }

    const academicError = getRegisterNumberAcademicError(form.register_number)
    if (academicError) {
      setApiError(academicError)
      return
    }

    setIsSendingOtp(true)
    setApiError('')
    setSuccessMessage('')
    try {
      await api.post('/auth/student/send-otp', {
        register_number: form.register_number.trim().toUpperCase(),
        alt_email: form.alt_email.trim().toLowerCase(),
      })
      setOtpSent(true)
      setOtpVerified(false)
      setOtp('')
      setSuccessMessage('OTP has been sent to your alternative email.')
      setResendTimer(60)
      const timer = window.setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            window.clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      const detail = err.response?.data?.detail
      setApiError(Array.isArray(detail) ? detail.map((d) => d.msg).join(' ') : detail || 'Unable to send OTP. Please try again.')
    } finally {
      setIsSendingOtp(false)
    }
  }

  async function handleOtpSubmit(e) {
    e.preventDefault()
    const validationErrors = validateStep(6, form, otp)
    setErrors(validationErrors)
    setApiError('')
    if (Object.keys(validationErrors).length > 0) return

    setIsVerifyingOtp(true)
    try {
      const response = await api.post('/auth/student/verify-otp', {
        register_number: form.register_number,
        otp,
      })
      setOtpVerified(true)
      setApiError('')
      setSuccessMessage(response.data.message || 'Alternative email verified successfully. Proceed with registration.')
    } catch (err) {
      const detail = err.response?.data?.detail
      setApiError(typeof detail === 'string' ? detail : 'Verification failed. Please try again.')
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const emailPreview = useMemo(() => getGeneratedEmailPreview(form.register_number), [form.register_number])

  useEffect(() => {
    let active = true
    async function loadAcademic() {
      try {
        const [branchesRes, batchesRes] = await Promise.all([
          api.get('/academic/branches'),
          api.get('/academic/batches'),
        ])
        if (!active) return
        setApprovedBranches(branchesRes.data || [])
        setApprovedBatches(batchesRes.data || [])
        setAcademicValidated(true)
      } catch (err) {
        if (!active) return
        setAcademicFetchError('Could not load approved branch and batch data. Registration will still validate on submit.')
      } finally {
        if (!active) return
        setAcademicLoaded(true)
      }
    }
    loadAcademic()
    return () => { active = false }
  }, [])

  function renderStepContent() {
    switch (step) {
      case 1:
        return (
          <>
            <label className="auth-field">
              <span>Full name</span>
              <input type="text" name="full_name" value={form.full_name} onChange={handleChange} placeholder="e.g. Varshini K" autoComplete="name" />
              {errors.full_name && <p className="auth-field-error">{errors.full_name}</p>}
            </label>
            <label className="auth-field">
              <span>Register number</span>
              <input type="text" name="register_number" value={form.register_number} onChange={handleChange} placeholder="e.g. 24B01A1286" />
              {errors.register_number && <p className="auth-field-error">{errors.register_number}</p>}
            </label>
            <label className="auth-field">
              <span>Date of birth</span>
              <input type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} />
              {errors.date_of_birth && <p className="auth-field-error">{errors.date_of_birth}</p>}
            </label>
            <label className="auth-field">
              <span>Mobile number</span>
              <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="10-digit mobile number" autoComplete="tel" />
              {errors.phone && <p className="auth-field-error">{errors.phone}</p>}
            </label>
            <label className="auth-field">
              <span>Alternative email</span>
              <input type="email" name="alt_email" value={form.alt_email} onChange={handleChange} placeholder="you@example.com" autoComplete="email" />
              {errors.alt_email && <p className="auth-field-error">{errors.alt_email}</p>}
            </label>
            <div className="student-register-otp-row">
              <button type="button" className="auth-btn student-register-secondary" onClick={sendOtp} disabled={isSendingOtp || resendTimer > 0 || !form.alt_email || !EMAIL_REGEX.test(form.alt_email.trim())}>
                {isSendingOtp ? 'Sending…' : resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Send OTP'}
              </button>
              {otpSent && <span className="student-register-otp-hint">OTP will be sent to your alternative email.</span>}
            </div>
            <label className="auth-field student-register-otp-field">
              <span>OTP</span>
              <div className="student-register-otp-input-row">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                />
                <button type="button" className="auth-btn student-register-secondary" onClick={handleOtpSubmit} disabled={isVerifyingOtp || !otpSent || otp.length !== 6}>
                  {isVerifyingOtp ? 'Verifying…' : 'Verify OTP'}
                </button>
              </div>
              {errors.otp && <p className="auth-field-error">{errors.otp}</p>}
            </label>
            <div className="student-register-verification-state">
              {otpVerified ? <span className="student-register-verified">✔ Verified</span> : <span className="student-register-pending">Pending verification</span>}
            </div>
            <label className="auth-field">
              <span>Category</span>
              <select name="category" value={form.category} onChange={handleChange}>
                <option value="">Select category</option>
                {CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              {errors.category && <p className="auth-field-error">{errors.category}</p>}
            </label>
            {emailPreview && (
              <label className="auth-field student-register-email-field">
                <span>College email</span>
                <div className="auth-readonly-row student-register-email-row">
                  <input type="text" value={emailPreview} readOnly className="auth-readonly" />
                  <button type="button" className="auth-copy-btn" onClick={handleCopyEmail} aria-label="Copy college email">
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </label>
            )}
          </>
        )
      case 2:
        return (
          <>
            <label className="auth-field">
              <span>Course</span>
              <input type="text" name="course" value={form.course} onChange={handleChange} placeholder="e.g. B.Tech" />
              {errors.course && <p className="auth-field-error">{errors.course}</p>}
            </label>
            <label className="auth-field">
              <span>Batch</span>
              <input type="text" name="batch" value={form.batch} onChange={handleChange} placeholder="e.g. 2024-2028" />
              {errors.batch && <p className="auth-field-error">{errors.batch}</p>}
            </label>
            <label className="auth-field">
              <span>Branch</span>
              <select name="branch" value={form.branch} onChange={handleChange}>
                <option value="">Select branch</option>
                {BRANCH_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              {errors.branch && <p className="auth-field-error">{errors.branch}</p>}
            </label>
            <label className="auth-field">
              <span>Section</span>
              <input type="text" name="section" value={form.section} onChange={handleChange} placeholder="e.g. A" />
              {errors.section && <p className="auth-field-error">{errors.section}</p>}
            </label>
          </>
        )
      case 3:
        return (
          <>
            <label className="auth-field">
              <span>Father’s name</span>
              <input type="text" name="father_name" value={form.father_name} onChange={handleChange} placeholder="Enter father’s name" />
              {errors.father_name && <p className="auth-field-error">{errors.father_name}</p>}
            </label>
            <label className="auth-field">
              <span>Father occupation</span>
              <input type="text" name="father_occupation" value={form.father_occupation} onChange={handleChange} placeholder="Enter occupation" />
              {errors.father_occupation && <p className="auth-field-error">{errors.father_occupation}</p>}
            </label>
            <label className="auth-field">
              <span>Mother’s name</span>
              <input type="text" name="mother_name" value={form.mother_name} onChange={handleChange} placeholder="Enter mother’s name" />
              {errors.mother_name && <p className="auth-field-error">{errors.mother_name}</p>}
            </label>
            <label className="auth-field">
              <span>Mother’s maiden name</span>
              <input type="text" name="mother_maiden_name" value={form.mother_maiden_name} onChange={handleChange} placeholder="Enter maiden name" />
              {errors.mother_maiden_name && <p className="auth-field-error">{errors.mother_maiden_name}</p>}
            </label>
            <label className="auth-field">
              <span>Parent’s mobile</span>
              <input type="tel" name="parent_mobile_no" value={form.parent_mobile_no} onChange={handleChange} placeholder="10-digit mobile number" />
              {errors.parent_mobile_no && <p className="auth-field-error">{errors.parent_mobile_no}</p>}
            </label>
          </>
        )
      case 4:
        return (
          <>
            <label className="auth-field student-register-textarea-field">
              <span>Address for communication</span>
              <textarea name="address_for_communication" value={form.address_for_communication} onChange={handleChange} rows={4} placeholder="Enter full address" />
              {errors.address_for_communication && <p className="auth-field-error">{errors.address_for_communication}</p>}
            </label>
            <label className="auth-field">
              <span>Hometown</span>
              <input type="text" name="hometown" value={form.hometown} onChange={handleChange} placeholder="Enter hometown" />
              {errors.hometown && <p className="auth-field-error">{errors.hometown}</p>}
            </label>
            <label className="auth-field">
              <span>District</span>
              <input type="text" name="district" value={form.district} onChange={handleChange} placeholder="Enter district" />
              {errors.district && <p className="auth-field-error">{errors.district}</p>}
            </label>
            <label className="auth-field">
              <span>State</span>
              <input type="text" name="state" value={form.state} onChange={handleChange} placeholder="Enter state" />
              {errors.state && <p className="auth-field-error">{errors.state}</p>}
            </label>
            <label className="auth-field">
              <span>Pincode</span>
              <input type="tel" name="pincode" value={form.pincode} onChange={handleChange} placeholder="6-digit pincode" />
              {errors.pincode && <p className="auth-field-error">{errors.pincode}</p>}
            </label>
            <label className="auth-field">
              <span>Stay type</span>
              <select name="stay_type" value={form.stay_type} onChange={handleChange}>
                <option value="">Select stay type</option>
                {STAY_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              {errors.stay_type && <p className="auth-field-error">{errors.stay_type}</p>}
            </label>
          </>
        )
      case 5:
        return (
          <>
            <label className="auth-field">
              <span>Aadhar number</span>
              <input type="tel" name="aadhar_no" value={form.aadhar_no} onChange={handleChange} placeholder="12-digit Aadhar number" />
              {errors.aadhar_no && <p className="auth-field-error">{errors.aadhar_no}</p>}
            </label>
            <label className="auth-field">
              <span>Name as per Aadhar</span>
              <input type="text" name="name_as_per_aadhar" value={form.name_as_per_aadhar} onChange={handleChange} placeholder="Enter exact name" />
              {errors.name_as_per_aadhar && <p className="auth-field-error">{errors.name_as_per_aadhar}</p>}
            </label>
            <label className="auth-field">
              <span>PAN number</span>
              <input type="text" name="pan_number" value={form.pan_number} onChange={handleChange} placeholder="Optional" />
              {errors.pan_number && <p className="auth-field-error">{errors.pan_number}</p>}
            </label>
            <label className="auth-field auth-field-password">
              <span>Password</span>
              <div className="auth-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  placeholder="Create a password"
                />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((s) => !s)} aria-label="Toggle password visibility">
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password && <p className="auth-field-error">{errors.password}</p>}
              <div className={`password-strength ${form.password ? '' : 'hidden'}`}>
                <div className={`strength-bar ${form.password.length >= 8 ? 'ok' : ''} ${(/[A-Z]/.test(form.password) && /[a-z]/.test(form.password) && /\d/.test(form.password)) ? 'strong' : ''}`} />
                <small className="strength-copy">
                  {form.password
                    ? form.password.length < 8
                      ? 'Weak'
                      : /[A-Z]/.test(form.password) && /[a-z]/.test(form.password) && /\d/.test(form.password)
                        ? 'Strong'
                        : 'Medium'
                    : ''}
                </small>
              </div>
            </label>
            <label className="auth-field auth-field-password">
              <span>Confirm password</span>
              <div className="auth-password-wrap">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirm_password"
                  value={form.confirm_password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  placeholder="Repeat the password"
                />
                <button type="button" className="auth-password-toggle" onClick={() => setShowConfirmPassword((s) => !s)} aria-label="Toggle confirm password visibility">
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.confirm_password && <p className="auth-field-error">{errors.confirm_password}</p>}
            </label>
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="auth-page student-register-page">
      <div className="auth-card student-register-card">
        <h1 className="auth-title student-register-title">Student Registration</h1>

        {step < 6 ? (
          <form onSubmit={handleNext} noValidate className="auth-form student-register-form">
            {apiError && <p className="auth-error">{apiError}</p>}
            {academicFetchError && <p className="auth-error">{academicFetchError}</p>}
            {renderStepContent()}
            <div className="student-register-actions">
              <button type="button" className="auth-text-btn" onClick={() => setStep((prev) => Math.max(1, prev - 1))} disabled={step === 1 || isSubmitting}>
                Previous
              </button>
              <button type="submit" className="auth-btn student-register-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : step === 5 ? 'Submit' : 'Next'}
              </button>
            </div>
          </form>
        ) : (
          <div className="student-register-success-panel">
            <p className="auth-success">{successMessage}</p>
            <Link to="/login/student" className="auth-btn student-register-primary student-register-link-btn">
              Go to login
            </Link>
          </div>
        )}

        <div className="auth-footer student-register-footer">
          <span>
            Already have an account? <Link to="/login/student">Log in</Link>
          </span>
        </div>
      </div>
    </div>
  )
}

export default StudentRegister